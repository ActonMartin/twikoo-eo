/*!
 * Twikoo EdgeOne Pages Node Function - 通知服务
 * 直接实现通知功能，避免依赖 jsdom
 * (c) 2020-present iMaeGoo
 * Released under the MIT License.
 */

import nodemailer from 'nodemailer'
import pushooDefault from 'pushoo'
import { AkismetClient } from 'akismet-api'
import axios from 'axios'
import md5 from 'blueimp-md5'
import CryptoJS from 'crypto-js'

const pushoo = pushooDefault.default || pushooDefault
const { SHA256 } = CryptoJS

// 响应码
const RES_CODE = {
  SUCCESS: 0,
  FAIL: 1000,
  NEED_LOGIN: 1024,
  FORBIDDEN: 1403
}

// 邮件传输器
let transporter = null

/**
 * Node Function 入口 - POST 请求
 */
export async function onRequestPost({ request }) {
  const corsHeaders = getCorsHeaders()

  try {
    // 验证内部调用
    const isInternal = request.headers.get('X-Twikoo-Internal') === 'true'
    if (!isInternal) {
      return new Response(JSON.stringify({
        code: RES_CODE.FORBIDDEN,
        message: '禁止直接访问'
      }), { headers: corsHeaders })
    }

    const body = await request.json()
    const { action, data } = body
    let res = {}

    switch (action) {
      case 'postSubmit':
        res = await handlePostSubmit(data)
        break
      case 'emailTest':
        res = await handleEmailTest(data)
        break
      case 'getQQAvatar':
        res = await handleGetQQAvatar(data)
        break
      default:
        res = { code: RES_CODE.FAIL, message: '未知操作' }
    }

    return new Response(JSON.stringify(res), { headers: corsHeaders })
  } catch (e) {
    console.error('Node Function 错误：', e.message, e.stack)
    return new Response(JSON.stringify({
      code: RES_CODE.FAIL,
      message: e.message
    }), { headers: corsHeaders })
  }
}

/**
 * Node Function 入口 - OPTIONS 请求
 */
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders()
  })
}

function getCorsHeaders() {
  return {
    'Content-Type': 'application/json; charset=UTF-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Twikoo-Internal',
    'Access-Control-Max-Age': '600'
  }
}

// ==================== 工具函数 ====================

function normalizeMail(mail) {
  return String(mail).trim().toLowerCase()
}

function equalsMail(mail1, mail2) {
  if (!mail1 || !mail2) return false
  return normalizeMail(mail1) === normalizeMail(mail2)
}

function isQQ(mail) {
  return /^[1-9][0-9]{4,10}$/.test(mail) ||
    /^[1-9][0-9]{4,10}@qq.com$/i.test(mail)
}

function getMailMd5(comment) {
  if (comment.mailMd5) return comment.mailMd5
  if (comment.mail) return md5(normalizeMail(comment.mail))
  return md5(comment.nick)
}

function getMailSha256(comment) {
  if (comment.mail) return SHA256(normalizeMail(comment.mail)).toString()
  return SHA256(comment.nick).toString()
}

function getAvatar(comment, config) {
  if (comment.avatar) return comment.avatar
  const gravatarCdn = config.GRAVATAR_CDN || 'weavatar.com'
  let defaultGravatar = `initials&name=${comment.nick}`
  if (config.DEFAULT_GRAVATAR) {
    defaultGravatar = config.DEFAULT_GRAVATAR
  }
  const mailHash = gravatarCdn === 'cravatar.cn' ? getMailMd5(comment) : getMailSha256(comment)
  return `https://${gravatarCdn}/avatar/${mailHash}?d=${defaultGravatar}`
}

function appendHashToUrl(url, hash) {
  if (url.indexOf('#') === -1) {
    return `${url}#${hash}`
  } else {
    return `${url.substring(0, url.indexOf('#'))}#${hash}`
  }
}

// 简单的 HTML 标签移除（用于即时消息推送）
function stripHtml(html) {
  return html.replace(/<[^>]*>/g, '').trim()
}

// ==================== 邮件功能 ====================

async function initMailer(config, throwErr = false) {
  try {
    if (!config || !config.SMTP_USER || !config.SMTP_PASS) {
      throw new Error('数据库配置不存在')
    }
    const transportConfig = {
      auth: {
        user: config.SMTP_USER,
        pass: config.SMTP_PASS
      }
    }
    if (config.SMTP_SERVICE) {
      transportConfig.service = config.SMTP_SERVICE
    } else if (config.SMTP_HOST) {
      transportConfig.host = config.SMTP_HOST
      transportConfig.port = parseInt(config.SMTP_PORT)
      transportConfig.secure = config.SMTP_SECURE === 'true'
    } else {
      throw new Error('SMTP 服务器没有配置')
    }
    transporter = nodemailer.createTransport(transportConfig)
    try {
      const success = await transporter.verify()
      if (success) console.log('SMTP 邮箱配置正常')
    } catch (error) {
      throw new Error('SMTP 邮箱配置异常：' + error.message)
    }
    return true
  } catch (e) {
    if (throwErr) {
      console.error('邮件初始化异常：', e.message)
      throw e
    } else {
      console.warn('邮件初始化异常：', e.message)
    }
    return false
  }
}

// 博主通知
async function noticeMaster(comment, config) {
  if (!transporter && !await initMailer(config)) {
    console.log('未配置邮箱或邮箱配置有误，不通知')
    return
  }
  if (equalsMail(config.BLOGGER_EMAIL, comment.mail)) {
    console.log('博主本人评论，不发送通知给博主')
    return
  }
  // 判断是否存在即时消息推送配置
  const hasIMPushConfig = config.PUSHOO_CHANNEL && config.PUSHOO_TOKEN
  if (hasIMPushConfig && config.SC_MAIL_NOTIFY !== 'true') {
    console.log('存在即时消息推送配置，默认不发送邮件给博主')
    return
  }
  
  const SITE_NAME = config.SITE_NAME
  const NICK = comment.nick
  const IMG = getAvatar(comment, config)
  const IP = comment.ip
  const MAIL = comment.mail
  const COMMENT = comment.comment
  const SITE_URL = config.SITE_URL
  const POST_URL = appendHashToUrl(comment.href || SITE_URL + comment.url, comment.id || comment._id)
  const emailSubject = config.MAIL_SUBJECT_ADMIN || `${SITE_NAME}上有新评论了`
  
  let emailContent
  if (config.MAIL_TEMPLATE_ADMIN) {
    emailContent = config.MAIL_TEMPLATE_ADMIN
      .replace(/\${SITE_URL}/g, SITE_URL)
      .replace(/\${SITE_NAME}/g, SITE_NAME)
      .replace(/\${NICK}/g, NICK)
      .replace(/\${IMG}/g, IMG)
      .replace(/\${IP}/g, IP)
      .replace(/\${MAIL}/g, MAIL)
      .replace(/\${COMMENT}/g, COMMENT)
      .replace(/\${POST_URL}/g, POST_URL)
  } else {
    emailContent = `
      <div style="border-top:2px solid #12addb;box-shadow:0 1px 3px #aaaaaa;line-height:180%;padding:0 15px 12px;margin:50px auto;font-size:12px;">
        <h2 style="border-bottom:1px solid #dddddd;font-size:14px;font-weight:normal;padding:13px 0 10px 8px;">
          您在<a style="text-decoration:none;color: #12addb;" href="${SITE_URL}" target="_blank">${SITE_NAME}</a>上的文章有了新的评论
        </h2>
        <p><strong>${NICK}</strong>回复说：</p>
        <div style="background-color: #f5f5f5;padding: 10px 15px;margin:18px 0;word-wrap:break-word;">${COMMENT}</div>
        <p>您可以点击<a style="text-decoration:none; color:#12addb" href="${POST_URL}" target="_blank">查看回复的完整內容</a><br></p>
      </div>`
  }
  
  let sendResult
  try {
    sendResult = await transporter.sendMail({
      from: `"${config.SENDER_NAME}" <${config.SENDER_EMAIL}>`,
      to: config.BLOGGER_EMAIL || config.SENDER_EMAIL,
      subject: emailSubject,
      html: emailContent
    })
  } catch (e) {
    sendResult = e
  }
  console.log('博主通知结果：', sendResult)
  return sendResult
}

// 回复通知
async function noticeReply(currentComment, config, parentComment) {
  if (!currentComment.pid) {
    console.log('无父级评论，不通知')
    return
  }
  if (!parentComment) {
    console.log('未找到父评论，不通知')
    return
  }
  if (!transporter && !await initMailer(config)) {
    console.log('未配置邮箱或邮箱配置有误，不通知')
    return
  }
  if (equalsMail(config.BLOGGER_EMAIL, parentComment.mail)) {
    console.log('回复给博主，因为会发博主通知邮件，所以不再重复通知')
    return
  }
  if (equalsMail(currentComment.mail, parentComment.mail)) {
    console.log('回复自己的评论，不邮件通知')
    return
  }
  
  const PARENT_NICK = parentComment.nick
  const IMG = getAvatar(currentComment, config)
  const PARENT_IMG = getAvatar(parentComment, config)
  const SITE_NAME = config.SITE_NAME
  const NICK = currentComment.nick
  const COMMENT = currentComment.comment
  const PARENT_COMMENT = parentComment.comment
  const POST_URL = appendHashToUrl(currentComment.href || config.SITE_URL + currentComment.url, currentComment.id || currentComment._id)
  const SITE_URL = config.SITE_URL
  const emailSubject = config.MAIL_SUBJECT || `${PARENT_NICK}，您在『${SITE_NAME}』上的评论收到了回复`
  
  let emailContent
  if (config.MAIL_TEMPLATE) {
    emailContent = config.MAIL_TEMPLATE
      .replace(/\${IMG}/g, IMG)
      .replace(/\${PARENT_IMG}/g, PARENT_IMG)
      .replace(/\${SITE_URL}/g, SITE_URL)
      .replace(/\${SITE_NAME}/g, SITE_NAME)
      .replace(/\${PARENT_NICK}/g, PARENT_NICK)
      .replace(/\${PARENT_COMMENT}/g, PARENT_COMMENT)
      .replace(/\${NICK}/g, NICK)
      .replace(/\${COMMENT}/g, COMMENT)
      .replace(/\${POST_URL}/g, POST_URL)
  } else {
    emailContent = `
      <div style="border-top:2px solid #12ADDB;box-shadow:0 1px 3px #AAAAAA;line-height:180%;padding:0 15px 12px;margin:50px auto;font-size:12px;">
        <h2 style="border-bottom:1px solid #dddddd;font-size:14px;font-weight:normal;padding:13px 0 10px 8px;">
          您在<a style="text-decoration:none;color: #12ADDB;" href="${SITE_URL}" target="_blank">${SITE_NAME}</a>上的评论有了新的回复
        </h2>
        ${PARENT_NICK} 同学，您曾发表评论：
        <div style="padding:0 12px 0 12px;margin-top:18px">
          <div style="background-color: #f5f5f5;padding: 10px 15px;margin:18px 0;word-wrap:break-word;">${PARENT_COMMENT}</div>
          <p><strong>${NICK}</strong>回复说：</p>
          <div style="background-color: #f5f5f5;padding: 10px 15px;margin:18px 0;word-wrap:break-word;">${COMMENT}</div>
          <p>
            您可以点击<a style="text-decoration:none; color:#12addb" href="${POST_URL}" target="_blank">查看回复的完整內容</a>，
            欢迎再次光临<a style="text-decoration:none; color:#12addb" href="${SITE_URL}" target="_blank">${SITE_NAME}</a>。<br>
          </p>
        </div>
      </div>`
  }
  
  let sendResult
  try {
    sendResult = await transporter.sendMail({
      from: `"${config.SENDER_NAME}" <${config.SENDER_EMAIL}>`,
      to: parentComment.mail,
      subject: emailSubject,
      html: emailContent
    })
  } catch (e) {
    sendResult = e
  }
  console.log('回复通知结果：', sendResult)
  return sendResult
}

// 即时消息通知
async function noticePushoo(comment, config) {
  if (!config.PUSHOO_CHANNEL || !config.PUSHOO_TOKEN) {
    console.log('没有配置 pushoo，放弃即时消息通知')
    return
  }
  if (equalsMail(config.BLOGGER_EMAIL, comment.mail)) {
    console.log('博主本人评论，不发送通知给博主')
    return
  }
  
  const SITE_NAME = config.SITE_NAME
  const NICK = comment.nick
  const MAIL = comment.mail
  const IP = comment.ip
  const COMMENT = stripHtml(comment.comment)
  const SITE_URL = config.SITE_URL
  const POST_URL = appendHashToUrl(comment.href || SITE_URL + comment.url, comment.id || comment._id)
  const subject = config.MAIL_SUBJECT_ADMIN || `${SITE_NAME}有新评论了`
  const content = `评论人：${NICK} ([${MAIL}](mailto:${MAIL}))

评论人IP：${IP}

评论内容：${COMMENT}

原文链接：[${POST_URL}](${POST_URL})`

  const sendResult = await pushoo(config.PUSHOO_CHANNEL, {
    token: config.PUSHOO_TOKEN,
    title: subject,
    content: content,
    options: {
      bark: {
        url: POST_URL
      }
    }
  })
  console.log('即时消息通知结果：', sendResult)
}

// 发送通知
async function sendNotice(comment, config, parentComment) {
  if (comment.isSpam && config.NOTIFY_SPAM === 'false') return
  await Promise.all([
    noticeMaster(comment, config),
    noticeReply(comment, config, parentComment),
    noticePushoo(comment, config)
  ]).catch(err => {
    console.error('通知异常：', err)
  })
}

// ==================== 垃圾检测 ====================

async function postCheckSpam(comment, config) {
  try {
    let isSpam
    if (comment.isSpam) {
      isSpam = true
    } else if (equalsMail(config.BLOGGER_EMAIL, comment.mail)) {
      isSpam = false
    } else if (config.QCLOUD_SECRET_ID && config.QCLOUD_SECRET_KEY) {
      // 腾讯云内容安全
      try {
        const tencentcloud = await import('tencentcloud-sdk-nodejs')
        const client = new tencentcloud.tms.v20201229.Client({
          credential: { secretId: config.QCLOUD_SECRET_ID, secretKey: config.QCLOUD_SECRET_KEY },
          region: 'ap-shanghai',
          profile: { httpProfile: { endpoint: 'tms.tencentcloudapi.com' } }
        })
        const textModerationParams = {
          Content: CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(comment.comment)),
          DataId: comment.id || comment._id,
          User: { Nickname: comment.nick },
          Device: { IP: comment.ip }
        }
        if (config.QCLOUD_CMS_BIZTYPE) {
          textModerationParams.BizType = config.QCLOUD_CMS_BIZTYPE
        }
        console.log('腾讯云请求参数：', textModerationParams)
        const checkResult = await client.TextModeration(textModerationParams)
        console.log('腾讯云返回结果：', checkResult)
        isSpam = checkResult.Suggestion !== 'Pass'
      } catch (e) {
        console.warn('腾讯云内容安全检测失败：', e.message)
      }
    } else if (config.AKISMET_KEY) {
      // Akismet
      const akismetClient = new AkismetClient({
        key: config.AKISMET_KEY,
        blog: config.SITE_URL
      })
      const isValid = await akismetClient.verifyKey()
      if (!isValid) {
        console.warn('Akismet key 不可用：', config.AKISMET_KEY)
        return
      }
      isSpam = await akismetClient.checkSpam({
        user_ip: comment.ip,
        user_agent: comment.ua,
        permalink: comment.href,
        comment_type: comment.rid ? 'reply' : 'comment',
        comment_author: comment.nick,
        comment_author_email: comment.mail,
        comment_author_url: comment.link,
        comment_content: comment.comment
      })
    }
    console.log('垃圾评论检测结果：', isSpam)
    return isSpam
  } catch (err) {
    console.error('垃圾评论检测异常：', err)
  }
}

// ==================== QQ 头像 ====================

async function getQQAvatar(qq) {
  try {
    const qqNum = qq.replace(/@qq.com/ig, '')
    const result = await axios.get(`https://aq.qq.com/cn2/get_img/get_face?img_type=3&uin=${qqNum}`)
    return result.data?.url || null
  } catch (e) {
    console.warn('获取 QQ 头像失败：', e.message)
    return null
  }
}

// ==================== 处理函数 ====================

/**
 * 提交后处理（垃圾检测 + 通知 + QQ头像）
 */
async function handlePostSubmit({ comment, config, parentComment }) {
  try {
    console.log('开始处理评论提交后任务')
    
    // 1. 获取 QQ 头像（如果是 QQ 邮箱且没有头像）
    if (!comment.avatar && isQQ(comment.mail)) {
      try {
        const qqNumber = comment.mail.replace(/@qq\.com$/i, '')
        const avatar = await getQQAvatar(qqNumber)
        if (avatar) {
          comment.avatar = avatar
          console.log('获取 QQ 头像成功：', avatar)
        }
      } catch (e) {
        console.warn('获取 QQ 头像失败：', e.message)
      }
    }
    
    // 2. 垃圾检测
    let isSpam = comment.isSpam
    if (!isSpam) {
      try {
        isSpam = await postCheckSpam(comment, config)
        console.log('垃圾检测结果：', isSpam)
      } catch (e) {
        console.error('垃圾检测失败：', e.message)
      }
    }
    
    // 3. 发送通知
    try {
      await sendNotice(comment, config, parentComment)
      console.log('通知发送完成')
    } catch (e) {
      console.error('发送通知失败：', e.message)
    }
    
    return { 
      code: RES_CODE.SUCCESS, 
      isSpam,
      avatar: comment.avatar
    }
  } catch (e) {
    console.error('提交后处理失败：', e.message)
    return { code: RES_CODE.FAIL, message: e.message }
  }
}

/**
 * 邮件测试
 */
async function handleEmailTest({ event, config, isAdmin }) {
  const res = {}
  if (isAdmin) {
    try {
      transporter = null
      await initMailer(config, true)
      const sendResult = await transporter.sendMail({
        from: config.SENDER_EMAIL,
        to: event.mail || config.BLOGGER_EMAIL || config.SENDER_EMAIL,
        subject: 'Twikoo 邮件通知测试邮件',
        html: '如果您收到这封邮件，说明 Twikoo 邮件功能配置正确'
      })
      res.result = sendResult
    } catch (e) {
      res.message = e.message
    }
  } else {
    res.code = RES_CODE.NEED_LOGIN
    res.message = '请先登录'
  }
  return res
}

/**
 * 获取 QQ 头像
 */
async function handleGetQQAvatar({ mail }) {
  try {
    if (!isQQ(mail)) {
      return { code: RES_CODE.FAIL, message: '不是 QQ 邮箱' }
    }
    const qqNumber = mail.replace(/@qq\.com$/i, '')
    const avatar = await getQQAvatar(qqNumber)
    return { code: RES_CODE.SUCCESS, avatar }
  } catch (e) {
    console.error('获取 QQ 头像失败：', e.message)
    return { code: RES_CODE.FAIL, message: e.message }
  }
}
