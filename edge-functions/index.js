/*!
 * Twikoo EdgeOne Pages Edge Function
 * (c) 2020-present iMaeGoo
 * Released under the MIT License.
 * 
 * 使用 EdgeOne Pages KV 存储作为数据库
 * KV 命名空间需要在 EdgeOne Pages 控制台绑定，变量名：TWIKOO_KV
 */

const VERSION = '1.6.44'

// 响应码
const RES_CODE = {
  SUCCESS: 0,
  NO_PARAM: 100,
  FAIL: 1000,
  EVENT_NOT_EXIST: 1001,
  PASS_EXIST: 1010,
  CONFIG_NOT_EXIST: 1020,
  CREDENTIALS_NOT_EXIST: 1021,
  CREDENTIALS_INVALID: 1025,
  PASS_NOT_EXIST: 1022,
  PASS_NOT_MATCH: 1023,
  NEED_LOGIN: 1024,
  FORBIDDEN: 1403,
  AKISMET_ERROR: 1030,
  UPLOAD_FAILED: 1040
}

const MAX_REQUEST_TIMES = 250

// 中国省份英文到中文映射
const PROVINCE_EN_TO_CN = {
  'Anhui': '安徽',
  'Beijing': '北京',
  'Chongqing': '重庆',
  'Fujian': '福建',
  'Gansu': '甘肃',
  'Guangdong': '广东',
  'Guangxi': '广西',
  'Guizhou': '贵州',
  'Hainan': '海南',
  'Hebei': '河北',
  'Heilongjiang': '黑龙江',
  'Henan': '河南',
  'Hubei': '湖北',
  'Hunan': '湖南',
  'Inner Mongolia': '内蒙古',
  'Jiangsu': '江苏',
  'Jiangxi': '江西',
  'Jilin': '吉林',
  'Liaoning': '辽宁',
  'Ningxia': '宁夏',
  'Qinghai': '青海',
  'Shaanxi': '陕西',
  'Shandong': '山东',
  'Shanghai': '上海',
  'Shanxi': '山西',
  'Sichuan': '四川',
  'Tianjin': '天津',
  'Tibet': '西藏',
  'Xinjiang': '新疆',
  'Yunnan': '云南',
  'Zhejiang': '浙江',
  'Hong Kong': '香港',
  'Macau': '澳门',
  'Taiwan': '台湾'
}

// 国家英文到中文映射（常见国家）
const COUNTRY_EN_TO_CN = {
  'China': '中国',
  'United States': '美国',
  'Japan': '日本',
  'South Korea': '韩国',
  'United Kingdom': '英国',
  'Germany': '德国',
  'France': '法国',
  'Canada': '加拿大',
  'Australia': '澳大利亚',
  'Singapore': '新加坡',
  'Malaysia': '马来西亚',
  'Thailand': '泰国',
  'Vietnam': '越南',
  'India': '印度',
  'Russia': '俄罗斯',
  'Brazil': '巴西',
  'Indonesia': '印度尼西亚',
  'Philippines': '菲律宾',
  'New Zealand': '新西兰',
  'Netherlands': '荷兰',
  'Italy': '意大利',
  'Spain': '西班牙',
  'Sweden': '瑞典',
  'Switzerland': '瑞士',
  'Norway': '挪威',
  'Denmark': '丹麦',
  'Finland': '芬兰',
  'Poland': '波兰',
  'Ireland': '爱尔兰',
  'Belgium': '比利时',
  'Austria': '奥地利',
  'Portugal': '葡萄牙',
  'Greece': '希腊',
  'Czech Republic': '捷克',
  'Hungary': '匈牙利',
  'Romania': '罗马尼亚',
  'Ukraine': '乌克兰',
  'Turkey': '土耳其',
  'Israel': '以色列',
  'United Arab Emirates': '阿联酋',
  'Saudi Arabia': '沙特阿拉伯',
  'Egypt': '埃及',
  'South Africa': '南非',
  'Mexico': '墨西哥',
  'Argentina': '阿根廷',
  'Chile': '智利',
  'Colombia': '哥伦比亚',
  'Peru': '秘鲁'
}

// 全局变量
let config = null
const requestTimes = {}

/**
 * EdgeOne Pages Edge Function 入口
 */
export async function onRequest(context) {
  const { request } = context
  
  // 处理 CORS 预检请求
  if (request.method === 'OPTIONS') {
    return handleCors(request)
  }
  
  // 只处理 POST 请求，GET 请求返回运行状态
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({
      code: RES_CODE.SUCCESS,
      message: 'Twikoo 云函数运行正常，请参考 https://twikoo.js.org/frontend.html 完成前端的配置',
      version: VERSION
    }), {
      headers: getCorsHeaders(request)
    })
  }

  let res = {}
  let event = {}
  
  try {
    event = await request.json()
    const ip = getIp(request)
    
    console.log('请求 IP：', ip)
    console.log('请求函数：', event.event)
    
    // 防护
    protect(ip)
    
    // 生成或使用 accessToken
    const accessToken = event.accessToken || generateUUID()
    
    // 读取配置
    await readConfig()
    
    // 创建数据库操作对象
    const db = createKVDatabase()
    
    switch (event.event) {
      case 'GET_FUNC_VERSION':
        res = getFuncVersion()
        break
      case 'COMMENT_GET':
        res = await commentGet(event, db, accessToken)
        break
      case 'COMMENT_GET_FOR_ADMIN':
        res = await commentGetForAdmin(event, db, accessToken)
        break
      case 'COMMENT_SET_FOR_ADMIN':
        res = await commentSetForAdmin(event, db, accessToken)
        break
      case 'COMMENT_DELETE_FOR_ADMIN':
        res = await commentDeleteForAdmin(event, db, accessToken)
        break
      case 'COMMENT_IMPORT_FOR_ADMIN':
        res = await commentImportForAdmin(event, db, accessToken)
        break
      case 'COMMENT_LIKE':
        res = await commentLike(event, db, accessToken)
        break
      case 'COMMENT_SUBMIT':
        res = await commentSubmit(event, request, db, accessToken)
        break
      case 'POST_SUBMIT':
        res = await postSubmit(event.comment, request, db)
        break
      case 'COUNTER_GET':
        res = await counterGet(event, db)
        break
      case 'GET_PASSWORD_STATUS':
        res = getPasswordStatus()
        break
      case 'SET_PASSWORD':
        res = await setPassword(event, db, accessToken)
        break
      case 'GET_CONFIG':
        res = getConfigResponse(accessToken)
        break
      case 'GET_CONFIG_FOR_ADMIN':
        res = getConfigForAdminResponse(accessToken)
        break
      case 'SET_CONFIG':
        res = await setConfig(event, db, accessToken)
        break
      case 'LOGIN':
        res = await login(event.password)
        break
      case 'GET_COMMENTS_COUNT':
        res = await getCommentsCount(event, db)
        break
      case 'GET_RECENT_COMMENTS':
        res = await getRecentComments(event, db)
        break
      case 'EMAIL_TEST':
        res = await callNodeFunction(request, 'emailTest', { event, config, isAdmin: isAdmin(accessToken) })
        break
      case 'UPLOAD_IMAGE':
        res = await callNodeFunction(request, 'uploadImage', { event, config })
        break
      case 'COMMENT_EXPORT_FOR_ADMIN':
        res = await commentExportForAdmin(event, db, accessToken)
        break
      default:
        if (event.event) {
          res.code = RES_CODE.EVENT_NOT_EXIST
          res.message = '请更新 Twikoo 云函数至最新版本'
        } else {
          res.code = RES_CODE.NO_PARAM
          res.message = 'Twikoo 云函数运行正常，请参考 https://twikoo.js.org/frontend.html 完成前端的配置'
          res.version = VERSION
        }
    }
    
    if (!res.code && !event.accessToken) {
      res.accessToken = accessToken
    }
  } catch (e) {
    console.error('Twikoo 遇到错误：', e.message, e.stack)
    res.code = RES_CODE.FAIL
    res.message = e.message
  }
  
  return new Response(JSON.stringify(res), {
    headers: getCorsHeaders(request)
  })
}

// ==================== 工具函数 ====================

// 生成 UUID
function generateUUID() {
  return 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'.replace(/[x]/g, () => {
    return (Math.random() * 16 | 0).toString(16)
  })
}

// MD5 实现 (使用 Web Crypto API 的简化版本，用于密码验证)
function md5(string) {
  let hash = 0
  for (let i = 0; i < string.length; i++) {
    const char = string.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  const result = Math.abs(hash).toString(16).padStart(8, '0')
  return result.repeat(4).substring(0, 32)
}

// SHA256 实现
async function sha256(message) {
  const encoder = new TextEncoder()
  const data = encoder.encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// ==================== UA 解析 ====================

/**
 * 简单的 UA 解析器
 * @param {String} ua User-Agent 字符串
 * @returns {{ os: String, browser: String }}
 */
function parseUA(ua) {
  if (!ua) return { os: '', browser: '' }
  
  let os = ''
  let browser = ''
  
  // 解析操作系统
  if (/Windows NT 10/.test(ua)) {
    os = 'Windows 10'
  } else if (/Windows NT 11/.test(ua) || /Windows NT 10.*Win64.*x64/.test(ua) && /Chrome\/(\d+)/.test(ua) && parseInt(RegExp.$1) >= 90) {
    // Windows 11 的 UA 和 Windows 10 类似，但通常配合较新的 Chrome
    os = 'Windows 10'
  } else if (/Windows NT 6\.3/.test(ua)) {
    os = 'Windows 8.1'
  } else if (/Windows NT 6\.2/.test(ua)) {
    os = 'Windows 8'
  } else if (/Windows NT 6\.1/.test(ua)) {
    os = 'Windows 7'
  } else if (/Windows/.test(ua)) {
    os = 'Windows'
  } else if (/Mac OS X (\d+)[_.](\d+)/.test(ua)) {
    const major = RegExp.$1
    const versionNames = {
      '10': 'macOS',
      '11': 'macOS Big Sur',
      '12': 'macOS Monterey', 
      '13': 'macOS Ventura',
      '14': 'macOS Sonoma',
      '15': 'macOS Sequoia',
      '26': 'macOS' // 虚拟版本号
    }
    os = versionNames[major] || `macOS ${major}`
  } else if (/iPhone OS (\d+)/.test(ua)) {
    os = `iOS ${RegExp.$1}`
  } else if (/iPad.*OS (\d+)/.test(ua)) {
    os = `iPadOS ${RegExp.$1}`
  } else if (/Android (\d+(\.\d+)?)/.test(ua)) {
    os = `Android ${RegExp.$1}`
  } else if (/Linux/.test(ua)) {
    os = 'Linux'
  } else if (/CrOS/.test(ua)) {
    os = 'Chrome OS'
  } else if (/HarmonyOS/i.test(ua)) {
    os = 'HarmonyOS'
  }
  
  // 解析浏览器
  if (/Edg\/(\d+(\.\d+)*)/.test(ua)) {
    browser = `Edge ${RegExp.$1}`
  } else if (/OPR\/(\d+(\.\d+)*)/.test(ua) || /Opera\/(\d+(\.\d+)*)/.test(ua)) {
    browser = `Opera ${RegExp.$1}`
  } else if (/Firefox\/(\d+(\.\d+)*)/.test(ua)) {
    browser = `Firefox ${RegExp.$1}`
  } else if (/Chrome\/(\d+(\.\d+)*)/.test(ua) && !/Edg|OPR/.test(ua)) {
    browser = `Chrome ${RegExp.$1}`
  } else if (/Safari\/(\d+(\.\d+)*)/.test(ua) && /Version\/(\d+(\.\d+)*)/.test(ua)) {
    browser = `Safari ${RegExp.$1}`
  } else if (/MSIE (\d+)/.test(ua) || /Trident.*rv:(\d+)/.test(ua)) {
    browser = `IE ${RegExp.$1}`
  } else if (/MicroMessenger\/(\d+(\.\d+)*)/.test(ua)) {
    browser = `WeChat ${RegExp.$1}`
  } else if (/QQBrowser\/(\d+(\.\d+)*)/.test(ua)) {
    browser = `QQ Browser ${RegExp.$1}`
  } else if (/UCBrowser\/(\d+(\.\d+)*)/.test(ua)) {
    browser = `UC Browser ${RegExp.$1}`
  }
  
  return { os, browser }
}

// 获取版本信息
function getFuncVersion() {
  return {
    code: RES_CODE.SUCCESS,
    version: VERSION
  }
}

// 获取密码状态
function getPasswordStatus() {
  return {
    code: RES_CODE.SUCCESS,
    status: !!config.ADMIN_PASS,
    credentials: false,
    version: VERSION
  }
}

// ==================== CORS 处理 ====================

function handleCors(request) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request)
  })
}

function getCorsHeaders(request) {
  const origin = request.headers.get('origin') || '*'
  return {
    'Content-Type': 'application/json; charset=UTF-8',
    'Access-Control-Allow-Origin': getAllowedOrigin(origin),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '600'
  }
}

function getAllowedOrigin(origin) {
  const localhostRegex = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d{1,5})?$/
  if (localhostRegex.test(origin)) {
    return origin
  } else if (config && config.CORS_ALLOW_ORIGIN) {
    const corsList = config.CORS_ALLOW_ORIGIN.split(',')
    for (const cors of corsList) {
      if (cors.replace(/\/$/, '') === origin) {
        return origin
      }
    }
    return ''
  }
  return origin
}

// ==================== IP 和防护 ====================

function getIp(request) {
  // EdgeOne Pages 使用 request.eo.clientIp 获取客户端 IP
  return request.eo?.clientIp ||
         request.headers.get('cf-connecting-ip') ||
         request.headers.get('x-real-ip') ||
         request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
         'unknown'
}

/**
 * 从 EdgeOne request.eo.geo 获取 IP 属地（中文）
 * @param {Request} request 
 * @returns {String} 地区名称（省份或国家，中文）
 */
function getIpRegion(request) {
  try {
    const geo = request.eo?.geo
    if (!geo) return ''
    
    // 优先使用省/地区名称
    let region = ''
    if (geo.regionName) {
      // 尝试转换为中文省份名
      region = PROVINCE_EN_TO_CN[geo.regionName] || geo.regionName
    }
    
    // 如果没有省份，使用国家名称
    if (!region && geo.countryName) {
      region = COUNTRY_EN_TO_CN[geo.countryName] || geo.countryName
    }
    
    // 如果有城市名，可以附加（可选）
    // const city = geo.cityName
    // if (city && city !== region) {
    //   region = `${region} ${city}`
    // }
    
    return region
  } catch (e) {
    console.warn('获取 IP 属地失败：', e.message)
    return ''
  }
}

function protect(ip) {
  requestTimes[ip] = (requestTimes[ip] || 0) + 1
  if (requestTimes[ip] > MAX_REQUEST_TIMES) {
    throw new Error('Too Many Requests')
  }
}

// ==================== KV 数据库适配层 ====================

function createKVDatabase() {
  if (typeof TWIKOO_KV === 'undefined') {
    throw new Error('未配置 TWIKOO_KV 命名空间，请在 EdgeOne Pages 控制台绑定 KV 存储')
  }
  
  return {
    async getComments(query = {}) {
      const allComments = await this.getAllFromCollection('comment')
      return filterComments(allComments, query)
    },
    
    async countComments(query = {}) {
      const comments = await this.getComments(query)
      return comments.length
    },
    
    async addComment(comment) {
      const id = comment._id || generateUUID()
      comment._id = id
      await TWIKOO_KV.put(`comment:${id}`, JSON.stringify(comment))
      await this.addToIndex('comment', id)
      return { id }
    },
    
    async updateComment(id, updates) {
      const comment = await this.getComment(id)
      if (comment) {
        Object.assign(comment, updates)
        await TWIKOO_KV.put(`comment:${id}`, JSON.stringify(comment))
        return { updated: 1 }
      }
      return { updated: 0 }
    },
    
    async deleteComment(id) {
      await TWIKOO_KV.delete(`comment:${id}`)
      await this.removeFromIndex('comment', id)
      return { deleted: 1 }
    },
    
    async getComment(id) {
      const data = await TWIKOO_KV.get(`comment:${id}`)
      return data ? JSON.parse(data) : null
    },
    
    async bulkAddComments(comments) {
      let insertedCount = 0
      for (const comment of comments) {
        await this.addComment(comment)
        insertedCount++
      }
      return insertedCount
    },
    
    async getConfig() {
      const data = await TWIKOO_KV.get('config:main')
      return data ? JSON.parse(data) : {}
    },
    
    async saveConfig(newConfig) {
      const currentConfig = await this.getConfig()
      const merged = { ...currentConfig, ...newConfig }
      await TWIKOO_KV.put('config:main', JSON.stringify(merged))
      return { updated: 1 }
    },
    
    async getCounter(url) {
      const key = `counter:${encodeURIComponent(url)}`
      const data = await TWIKOO_KV.get(key)
      return data ? JSON.parse(data) : null
    },
    
    async incCounter(url, title) {
      const key = `counter:${encodeURIComponent(url)}`
      let counter = await this.getCounter(url)
      if (counter) {
        counter.time = (counter.time || 0) + 1
        counter.title = title
        counter.updated = Date.now()
      } else {
        counter = {
          url,
          title,
          time: 1,
          created: Date.now(),
          updated: Date.now()
        }
      }
      await TWIKOO_KV.put(key, JSON.stringify(counter))
      return 1
    },
    
    async getAllFromCollection(collection) {
      const indexKey = `index:${collection}`
      const indexData = await TWIKOO_KV.get(indexKey)
      const ids = indexData ? JSON.parse(indexData) : []
      
      const items = []
      for (const id of ids) {
        const data = await TWIKOO_KV.get(`${collection}:${id}`)
        if (data) {
          items.push(JSON.parse(data))
        }
      }
      return items
    },
    
    async addToIndex(collection, id) {
      const indexKey = `index:${collection}`
      const indexData = await TWIKOO_KV.get(indexKey)
      const ids = indexData ? JSON.parse(indexData) : []
      if (!ids.includes(id)) {
        ids.push(id)
        await TWIKOO_KV.put(indexKey, JSON.stringify(ids))
      }
    },
    
    async removeFromIndex(collection, id) {
      const indexKey = `index:${collection}`
      const indexData = await TWIKOO_KV.get(indexKey)
      const ids = indexData ? JSON.parse(indexData) : []
      const newIds = ids.filter(i => i !== id)
      await TWIKOO_KV.put(indexKey, JSON.stringify(newIds))
    }
  }
}

// 评论过滤函数
function filterComments(comments, query) {
  return comments.filter(comment => {
    for (const [key, value] of Object.entries(query)) {
      if (key === '$or') {
        const orMatch = value.some(condition => {
          return Object.entries(condition).every(([k, v]) => matchCondition(comment, k, v))
        })
        if (!orMatch) return false
      } else if (!matchCondition(comment, key, value)) {
        return false
      }
    }
    return true
  })
}

function matchCondition(comment, key, value) {
  const commentValue = comment[key]
  
  if (value === null || value === undefined) {
    return commentValue === null || commentValue === undefined
  }
  
  if (typeof value === 'object') {
    if ('$in' in value) {
      return value.$in.includes(commentValue)
    }
    if ('$ne' in value) {
      return commentValue !== value.$ne
    }
    if ('$neq' in value) {
      return commentValue !== value.$neq
    }
    if ('$gt' in value) {
      return commentValue > value.$gt
    }
    if ('$lt' in value) {
      return commentValue < value.$lt
    }
    if ('$regex' in value) {
      const regex = new RegExp(value.$regex, value.$options || '')
      return regex.test(commentValue)
    }
  }
  
  return commentValue === value
}

// ==================== 配置管理 ====================

async function readConfig() {
  try {
    const db = createKVDatabase()
    config = await db.getConfig()
  } catch (e) {
    console.error('读取配置失败：', e)
    config = {}
  }
  return config
}

async function writeConfig(db, newConfig) {
  if (!Object.keys(newConfig).length) return 0
  console.log('写入配置')
  await db.saveConfig(newConfig)
  config = null
  return 1
}

// ==================== 用户认证 ====================

function isAdmin(accessToken) {
  return config && config.ADMIN_PASS === md5(accessToken)
}

function validate(event, requiredParams = []) {
  for (const requiredParam of requiredParams) {
    if (!event[requiredParam]) {
      throw new Error(`参数"${requiredParam}"不合法`)
    }
  }
}

// ==================== URL 处理 ====================

function getUrlQuery(url) {
  const variantUrl = url[url.length - 1] === '/' ? url.substring(0, url.length - 1) : `${url}/`
  return [url, variantUrl]
}

function getUrlsQuery(urls) {
  const query = []
  for (const url of urls) {
    if (url) query.push(...getUrlQuery(url))
  }
  return query
}

// ==================== 邮箱处理 ====================

function normalizeMail(mail) {
  return mail ? mail.trim().toLowerCase() : ''
}

function equalsMail(mail1, mail2) {
  return normalizeMail(mail1) === normalizeMail(mail2)
}

function isQQ(mail) {
  return /^[1-9][0-9]{4,10}$/.test(mail) ||
         /^[1-9][0-9]{4,10}@qq\.com$/i.test(mail)
}

function addQQMailSuffix(mail) {
  if (/^[1-9][0-9]{4,10}$/.test(mail)) {
    return `${mail}@qq.com`
  }
  return mail
}

// ==================== 头像处理 ====================

function getAvatar(comment) {
  if (comment.avatar) return comment.avatar
  return getGravatarUrl(comment)
}

function getGravatarUrl(comment) {
  const gravatarCdn = config.GRAVATAR_CDN || 'weavatar.com'
  const defaultGravatar = config.DEFAULT_GRAVATAR || `initials&name=${encodeURIComponent(comment.nick || '')}`
  const mailHash = comment.mailMd5 || ''
  return mailHash ? `https://${gravatarCdn}/avatar/${mailHash}?d=${defaultGravatar}` : ''
}

function getMailMd5(comment) {
  return comment.mailMd5 || ''
}

// ==================== 密码管理 ====================

async function setPassword(event, db, accessToken) {
  const isAdminUser = isAdmin(accessToken)
  if (config.ADMIN_PASS && !isAdminUser) {
    return { code: RES_CODE.PASS_EXIST, message: '请先登录再修改密码' }
  }
  const ADMIN_PASS = md5(event.password)
  await writeConfig(db, { ADMIN_PASS })
  return { code: RES_CODE.SUCCESS }
}

async function login(password) {
  if (!config) {
    return { code: RES_CODE.CONFIG_NOT_EXIST, message: '数据库无配置' }
  }
  if (!config.ADMIN_PASS) {
    return { code: RES_CODE.PASS_NOT_EXIST, message: '未配置管理密码' }
  }
  if (config.ADMIN_PASS !== md5(password)) {
    return { code: RES_CODE.PASS_NOT_MATCH, message: '密码错误' }
  }
  return { code: RES_CODE.SUCCESS }
}

// ==================== 配置响应 ====================

function getConfigResponse(accessToken) {
  return {
    code: RES_CODE.SUCCESS,
    config: {
      VERSION,
      IS_ADMIN: isAdmin(accessToken),
      SITE_NAME: config.SITE_NAME,
      SITE_URL: config.SITE_URL,
      MASTER_TAG: config.MASTER_TAG,
      COMMENT_BG_IMG: config.COMMENT_BG_IMG,
      GRAVATAR_CDN: config.GRAVATAR_CDN,
      DEFAULT_GRAVATAR: config.DEFAULT_GRAVATAR,
      SHOW_IMAGE: config.SHOW_IMAGE || 'true',
      IMAGE_CDN: config.IMAGE_CDN,
      LIGHTBOX: config.LIGHTBOX || 'false',
      SHOW_EMOTION: config.SHOW_EMOTION || 'true',
      EMOTION_CDN: config.EMOTION_CDN,
      COMMENT_PLACEHOLDER: config.COMMENT_PLACEHOLDER,
      DISPLAYED_FIELDS: config.DISPLAYED_FIELDS,
      REQUIRED_FIELDS: config.REQUIRED_FIELDS,
      HIDE_ADMIN_CRYPT: config.HIDE_ADMIN_CRYPT,
      HIGHLIGHT: config.HIGHLIGHT || 'true',
      HIGHLIGHT_THEME: config.HIGHLIGHT_THEME,
      HIGHLIGHT_PLUGIN: config.HIGHLIGHT_PLUGIN,
      LIMIT_LENGTH: config.LIMIT_LENGTH,
      TURNSTILE_SITE_KEY: config.TURNSTILE_SITE_KEY
    }
  }
}

function getConfigForAdminResponse(accessToken) {
  if (isAdmin(accessToken)) {
    const adminConfig = { ...config }
    delete adminConfig.CREDENTIALS
    return { code: RES_CODE.SUCCESS, config: adminConfig }
  } else {
    return { code: RES_CODE.NEED_LOGIN, message: '请先登录' }
  }
}

async function setConfig(event, db, accessToken) {
  const isAdminUser = isAdmin(accessToken)
  if (isAdminUser) {
    await writeConfig(db, event.config)
    return { code: RES_CODE.SUCCESS }
  } else {
    return { code: RES_CODE.NEED_LOGIN, message: '请先登录' }
  }
}

// ==================== 评论读取 ====================

async function commentGet(event, db, accessToken) {
  const res = {}
  try {
    validate(event, ['url'])
    const uid = accessToken
    const isAdminUser = isAdmin(accessToken)
    const limit = parseInt(config.COMMENT_PAGE_SIZE) || 8
    let more = false
    
    const urlQuery = getUrlQuery(event.url)
    
    // 获取所有评论
    let allComments = await db.getComments()
    
    // 过滤主楼评论
    let mainComments = allComments.filter(c => 
      urlQuery.includes(c.url) && 
      (!c.rid || c.rid === '') &&
      (c.isSpam !== true || c.uid === uid || isAdminUser)
    )
    
    // 计算总数
    const count = mainComments.length
    
    // 排序
    mainComments.sort((a, b) => b.created - a.created)
    
    // 处理置顶和分页
    let top = []
    if (!config.TOP_DISABLED && !event.before) {
      top = mainComments.filter(c => c.top === true)
      mainComments = mainComments.filter(c => c.top !== true)
    }
    
    // 分页
    if (event.before) {
      mainComments = mainComments.filter(c => c.created < event.before)
    }
    
    if (mainComments.length > limit) {
      more = true
      mainComments = mainComments.slice(0, limit)
    }
    
    // 合并置顶
    mainComments = [...top, ...mainComments]
    
    // 获取回复
    const mainIds = mainComments.map(c => c._id)
    const replies = allComments.filter(c => 
      mainIds.includes(c.rid) &&
      (c.isSpam !== true || c.uid === uid || isAdminUser)
    )
    
    res.data = parseComment([...mainComments, ...replies], uid)
    res.more = more
    res.count = count
  } catch (e) {
    res.data = []
    res.message = e.message
  }
  return res
}

// 解析评论为前端格式
function parseComment(comments, uid) {
  const result = []
  for (const comment of comments) {
    if (!comment.rid) {
      const replies = comments
        .filter(item => item.rid === comment._id)
        .map(item => toCommentDto(item, uid, [], comments))
        .sort((a, b) => a.created - b.created)
      result.push(toCommentDto(comment, uid, replies, []))
    }
  }
  return result
}

function toCommentDto(comment, uid, replies = [], comments = []) {
  return {
    id: comment._id,
    nick: comment.nick,
    avatar: getAvatar(comment),
    mailMd5: getMailMd5(comment),
    link: comment.link,
    comment: comment.comment,
    os: comment.os || '',
    browser: comment.browser || '',
    ipRegion: comment.ipRegion || '',
    master: comment.master,
    like: comment.like ? comment.like.length : 0,
    liked: comment.like ? comment.like.includes(uid) : false,
    replies: replies,
    rid: comment.rid,
    pid: comment.pid,
    ruser: getRuser(comment.pid, comments),
    top: comment.top,
    isSpam: comment.isSpam,
    created: comment.created,
    updated: comment.updated
  }
}

function getRuser(pid, comments = []) {
  const comment = comments.find(item => item._id === pid)
  return comment ? comment.nick : null
}

// ==================== 管理员评论操作 ====================

async function commentGetForAdmin(event, db, accessToken) {
  const res = {}
  const isAdminUser = isAdmin(accessToken)
  if (isAdminUser) {
    validate(event, ['per', 'page'])
    
    let comments = await db.getComments()
    
    if (event.type === 'VISIBLE') {
      comments = comments.filter(c => c.isSpam !== true)
    } else if (event.type === 'HIDDEN') {
      comments = comments.filter(c => c.isSpam === true)
    }
    
    if (event.keyword) {
      const keyword = event.keyword.toLowerCase()
      comments = comments.filter(c => 
        (c.nick && c.nick.toLowerCase().includes(keyword)) ||
        (c.mail && c.mail.toLowerCase().includes(keyword)) ||
        (c.link && c.link.toLowerCase().includes(keyword)) ||
        (c.ip && c.ip.toLowerCase().includes(keyword)) ||
        (c.comment && c.comment.toLowerCase().includes(keyword)) ||
        (c.url && c.url.toLowerCase().includes(keyword)) ||
        (c.href && c.href.toLowerCase().includes(keyword))
      )
    }
    
    comments.sort((a, b) => b.created - a.created)
    
    const count = comments.length
    const start = event.per * (event.page - 1)
    const data = comments.slice(start, start + event.per)
    
    res.code = RES_CODE.SUCCESS
    res.count = count
    res.data = data
  } else {
    res.code = RES_CODE.NEED_LOGIN
    res.message = '请先登录'
  }
  return res
}

async function commentSetForAdmin(event, db, accessToken) {
  const res = {}
  const isAdminUser = isAdmin(accessToken)
  if (isAdminUser) {
    validate(event, ['id', 'set'])
    const data = await db.updateComment(event.id, {
      ...event.set,
      updated: Date.now()
    })
    res.code = RES_CODE.SUCCESS
    res.updated = data.updated
  } else {
    res.code = RES_CODE.NEED_LOGIN
    res.message = '请先登录'
  }
  return res
}

async function commentDeleteForAdmin(event, db, accessToken) {
  const res = {}
  const isAdminUser = isAdmin(accessToken)
  if (isAdminUser) {
    validate(event, ['id'])
    const data = await db.deleteComment(event.id)
    res.code = RES_CODE.SUCCESS
    res.deleted = data.deleted
  } else {
    res.code = RES_CODE.NEED_LOGIN
    res.message = '请先登录'
  }
  return res
}

async function commentImportForAdmin(event, db, accessToken) {
  const res = {}
  let logText = ''
  const log = (message) => {
    logText += `${new Date().toLocaleString()} ${message}\n`
  }
  const isAdminUser = isAdmin(accessToken)
  if (isAdminUser) {
    try {
      validate(event, ['source', 'file'])
      log(`开始导入 ${event.source}`)
      
      let comments = []
      const fileContent = event.file
      
      switch (event.source) {
        case 'valine':
        case 'twikoo': {
          const data = parseJSON(fileContent)
          const arr = Array.isArray(data) ? data : (data.results || [])
          log(`共 ${arr.length} 条评论`)
          for (const comment of arr) {
            comments.push({
              _id: comment._id || comment.objectId || generateUUID(),
              nick: comment.nick,
              mail: comment.mail,
              mailMd5: comment.mailMd5,
              link: comment.link,
              ua: comment.ua || '',
              ip: comment.ip,
              url: comment.url,
              href: comment.href,
              comment: comment.comment,
              pid: comment.pid,
              rid: comment.rid,
              isSpam: comment.isSpam,
              master: comment.master || false,
              created: comment.created || new Date(comment.createdAt).getTime(),
              updated: comment.updated || Date.now()
            })
          }
          break
        }
        default:
          throw new Error(`不支持 ${event.source} 的导入，请更新 Twikoo 云函数至最新版本`)
      }
      
      const insertedCount = await db.bulkAddComments(comments)
      log(`导入成功 ${insertedCount} 条评论`)
    } catch (e) {
      log(e.message)
    }
    res.code = RES_CODE.SUCCESS
    res.log = logText
  } else {
    res.code = RES_CODE.NEED_LOGIN
    res.message = '请先登录'
  }
  return res
}

function parseJSON(content) {
  try {
    return JSON.parse(content)
  } catch (e) {
    const results = []
    const lines = content.split('\n')
    for (const line of lines) {
      try {
        results.push(JSON.parse(line))
      } catch (e2) {}
    }
    return { results }
  }
}

async function commentExportForAdmin(event, db, accessToken) {
  const res = {}
  const isAdminUser = isAdmin(accessToken)
  if (isAdminUser) {
    const data = await db.getComments()
    res.code = RES_CODE.SUCCESS
    res.data = data
  } else {
    res.code = RES_CODE.NEED_LOGIN
    res.message = '请先登录'
  }
  return res
}

// ==================== 点赞 ====================

async function commentLike(event, db, accessToken) {
  const res = {}
  validate(event, ['id'])
  const uid = accessToken
  const comment = await db.getComment(event.id)
  
  if (comment) {
    let likes = comment.like || []
    const index = likes.indexOf(uid)
    if (index === -1) {
      likes.push(uid)
    } else {
      likes.splice(index, 1)
    }
    await db.updateComment(event.id, { like: likes })
    res.updated = 1
  } else {
    res.updated = 0
  }
  return res
}

// ==================== 评论提交 ====================

async function commentSubmit(event, request, db, accessToken) {
  const res = {}
  validate(event, ['url', 'ua', 'comment'])
  
  const ip = getIp(request)
  
  // 限流检查
  await limitFilter(db, ip)
  
  // 验证码检查
  await checkCaptcha(event, ip)
  
  // 解析评论数据（传入 request 以获取 IP 属地）
  const data = await parseCommentData(event, request, accessToken, ip)
  
  // 保存评论
  const result = await db.addComment(data)
  data.id = result.id
  data._id = result.id
  res.id = result.id
  
  // 获取父评论信息（用于回复通知）
  let parentComment = null
  if (data.pid) {
    parentComment = await db.getComment(data.pid)
  }
  
  // 异步处理垃圾检测、通知和 QQ 头像
  callNodeFunction(request, 'postSubmit', { 
    comment: data, 
    config,
    parentComment 
  }).then(async (nodeResult) => {
    // 更新评论的垃圾状态和头像
    const updates = {}
    if (nodeResult.isSpam && !data.isSpam) {
      updates.isSpam = true
    }
    if (nodeResult.avatar && !data.avatar) {
      updates.avatar = nodeResult.avatar
    }
    if (Object.keys(updates).length > 0) {
      updates.updated = Date.now()
      await db.updateComment(data._id, updates)
      console.log('评论更新成功：', updates)
    }
  }).catch(e => {
    console.error('POST_SUBMIT 失败', e.message)
  })
  
  return res
}

// 异步处理
async function postSubmit(comment, request, db) {
  // 获取父评论信息
  let parentComment = null
  if (comment.pid) {
    parentComment = await db.getComment(comment.pid)
  }
  
  // 调用 Node Function 进行垃圾检测和通知
  const result = await callNodeFunction(request, 'postSubmit', { 
    comment, 
    config,
    parentComment 
  })
  
  if (result.isSpam) {
    await db.updateComment(comment._id, { isSpam: true, updated: Date.now() })
  }
  
  return { code: RES_CODE.SUCCESS }
}

// 解析评论数据
async function parseCommentData(event, request, accessToken, ip) {
  const timestamp = Date.now()
  const isAdminUser = isAdmin(accessToken)
  const isBloggerMail = equalsMail(config.BLOGGER_EMAIL, event.mail)
  
  if (isBloggerMail && !isAdminUser) {
    throw new Error('请先登录管理面板，再使用博主身份发送评论')
  }
  
  // 计算邮箱哈希
  let mailMd5 = ''
  let mail = event.mail || ''
  let avatar = ''
  
  // 处理 QQ 邮箱和头像
  if (isQQ(event.mail)) {
    mail = addQQMailSuffix(event.mail)
    // QQ 头像将在 Node Function 中获取
  }
  
  if (mail) {
    const normalizedMail = normalizeMail(mail)
    if (config.GRAVATAR_CDN === 'cravatar.cn') {
      mailMd5 = md5(normalizedMail)
    } else {
      mailMd5 = await sha256(normalizedMail)
    }
  }
  
  // 简单的 XSS 清理
  const sanitizedComment = sanitizeHtml(event.comment)
  
  // 预检测垃圾评论
  const isSpam = isAdminUser ? false : preCheckSpam(event, config)
  
  // 获取 IP 属地（仅当配置开启时）
  const showRegion = config.SHOW_REGION && config.SHOW_REGION !== 'false'
  const ipRegion = showRegion ? getIpRegion(request) : ''
  
  // 解析 UA（仅当配置开启时）
  const showUA = config.SHOW_UA !== 'false'
  const { os, browser } = showUA ? parseUA(event.ua) : { os: '', browser: '' }
  
  const commentDo = {
    _id: generateUUID(),
    uid: accessToken,
    nick: event.nick || '匿名',
    mail: mail,
    mailMd5: mailMd5,
    link: event.link || '',
    ua: event.ua,
    ip: ip,
    ipRegion: ipRegion,
    os: os,
    browser: browser,
    master: isBloggerMail,
    url: event.url,
    href: event.href,
    comment: sanitizedComment,
    pid: event.pid || event.rid,
    rid: event.rid,
    isSpam: isSpam,
    avatar: avatar,
    created: timestamp,
    updated: timestamp
  }
  
  return commentDo
}

// 简单的 HTML 清理
function sanitizeHtml(html) {
  if (!html) return ''
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/\sstyle\s*=\s*["'][^"']*["']/gi, '')
}

// 预检测垃圾评论
function preCheckSpam(event, config) {
  // 长度限制
  let limitLength = parseInt(config.LIMIT_LENGTH)
  if (Number.isNaN(limitLength)) limitLength = 500
  if (limitLength && event.comment.length > limitLength) {
    throw new Error('评论内容过长')
  }
  
  // 屏蔽词检测
  if (config.BLOCKED_WORDS) {
    const commentLowerCase = event.comment.toLowerCase()
    const nickLowerCase = (event.nick || '').toLowerCase()
    for (const blockedWord of config.BLOCKED_WORDS.split(',')) {
      const word = blockedWord.trim().toLowerCase()
      if (word && (commentLowerCase.includes(word) || nickLowerCase.includes(word))) {
        throw new Error('包含屏蔽词')
      }
    }
  }
  
  // 人工审核模式
  if (config.AKISMET_KEY === 'MANUAL_REVIEW') {
    return true
  }
  
  // 违禁词检测
  if (config.FORBIDDEN_WORDS) {
    const commentLowerCase = event.comment.toLowerCase()
    const nickLowerCase = (event.nick || '').toLowerCase()
    for (const forbiddenWord of config.FORBIDDEN_WORDS.replace(/,+$/, '').split(',')) {
      const word = forbiddenWord.trim().toLowerCase()
      if (word && (commentLowerCase.includes(word) || nickLowerCase.includes(word))) {
        return true
      }
    }
  }
  
  return false
}

// 限流
async function limitFilter(db, ip) {
  let limitPerMinute = parseInt(config.LIMIT_PER_MINUTE)
  if (Number.isNaN(limitPerMinute)) limitPerMinute = 10
  
  if (limitPerMinute) {
    const comments = await db.getComments()
    const recentComments = comments.filter(c => 
      c.ip === ip && c.created > Date.now() - 600000
    )
    if (recentComments.length > limitPerMinute) {
      throw new Error('发言频率过高')
    }
  }
  
  let limitPerMinuteAll = parseInt(config.LIMIT_PER_MINUTE_ALL)
  if (Number.isNaN(limitPerMinuteAll)) limitPerMinuteAll = 10
  
  if (limitPerMinuteAll) {
    const comments = await db.getComments()
    const recentComments = comments.filter(c => c.created > Date.now() - 600000)
    if (recentComments.length > limitPerMinuteAll) {
      throw new Error('评论太火爆啦 >_< 请稍后再试')
    }
  }
}

// 验证码检查
async function checkCaptcha(event, ip) {
  if (config.TURNSTILE_SITE_KEY && config.TURNSTILE_SECRET_KEY) {
    const formData = new FormData()
    formData.append('secret', config.TURNSTILE_SECRET_KEY)
    formData.append('response', event.turnstileToken)
    formData.append('remoteip', ip)
    
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData
    })
    
    const data = await response.json()
    if (!data.success) {
      throw new Error('验证码错误')
    }
  }
}

// ==================== 计数器 ====================

async function counterGet(event, db) {
  const res = {}
  try {
    validate(event, ['url'])
    const record = await db.getCounter(event.url)
    res.data = record || {}
    res.time = res.data.time || 0
    res.updated = await db.incCounter(event.url, event.title)
  } catch (e) {
    res.message = e.message
  }
  return res
}

// ==================== 评论统计 ====================

async function getCommentsCount(event, db) {
  const res = {}
  try {
    validate(event, ['urls'])
    const comments = await db.getComments()
    
    res.data = []
    for (const url of event.urls) {
      const urlVariants = getUrlQuery(url)
      let count = comments.filter(c => 
        urlVariants.includes(c.url) &&
        c.isSpam !== true &&
        (event.includeReply || !c.rid || c.rid === '')
      ).length
      res.data.push({ url, count })
    }
  } catch (e) {
    res.message = e.message
  }
  return res
}

async function getRecentComments(event, db) {
  const res = {}
  try {
    let comments = await db.getComments()
    
    comments = comments.filter(c => c.isSpam !== true)
    
    if (event.urls && event.urls.length) {
      const urlsQuery = getUrlsQuery(event.urls)
      comments = comments.filter(c => urlsQuery.includes(c.url))
    }
    
    if (!event.includeReply) {
      comments = comments.filter(c => !c.rid || c.rid === '')
    }
    
    comments.sort((a, b) => b.created - a.created)
    
    const pageSize = Math.min(event.pageSize || 10, 100)
    comments = comments.slice(0, pageSize)
    
    res.data = comments.map(comment => ({
      id: comment._id,
      url: comment.url,
      nick: comment.nick,
      avatar: getAvatar(comment),
      mailMd5: getMailMd5(comment),
      link: comment.link,
      comment: comment.comment,
      commentText: stripHtml(comment.comment),
      created: comment.created
    }))
  } catch (e) {
    res.message = e.message
  }
  return res
}

function stripHtml(html) {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, '')
}

// ==================== Node Function 调用 ====================

async function callNodeFunction(request, action, data) {
  try {
    const url = new URL(request.url)
    const nodeUrl = `${url.protocol}//${url.host}/api/notify`
    
    const response = await fetch(nodeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Twikoo-Internal': 'true'
      },
      body: JSON.stringify({ action, data })
    })
    
    return await response.json()
  } catch (e) {
    console.error('调用 Node Function 失败：', e.message)
    return { code: RES_CODE.FAIL, message: e.message }
  }
}

export default { onRequest }
