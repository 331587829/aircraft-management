const cloud = require('wx-server-sdk')

cloud.init({
  env: 'cloud1-8gaa4jfy4b22cd28'
})

// 获取数据库实例
const db = cloud.database()
const usersCollection = db.collection('users')
const adminsCollection = db.collection('admins')

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    
    // 检查openid是否存在
    if (!openid) {
      console.log('未获取到用户openid，返回未绑定状态')
      return {
        openid: '',
        appid: wxContext.APPID || '',
        unionid: wxContext.UNIONID || '',
        isBound: false,
        userInfo: null,
        isAdmin: false,
        message: '用户未登录或登录状态已过期'
      }
    }
    
    // 尝试从数据库中查找用户
    const userResult = await usersCollection.where({
      openid: openid
    }).get()
    
    // 检查用户是否已存在
    let isBound = false
    let userInfo = null
    let phoneNumber = null
    
    if (userResult.data && userResult.data.length > 0) {
      // 用户已存在，直接返回用户信息
      isBound = true
      userInfo = userResult.data[0]
      phoneNumber = userInfo.phoneNumber || null
      console.log('找到已绑定用户:', userInfo.userName || '未设置用户名')
    } else {
      // 用户不存在，自动创建基础用户记录
      const currentTime = db.serverDate()
      const newUserData = {
        openid: openid,
        appid: wxContext.APPID || '',
        userName: '', // 初始为空，用户需要后续完善
        phoneNumber: '',
        createTime: currentTime,
        updateTime: currentTime,
        status: 'active'
      }
      
      try {
        const createResult = await usersCollection.add({
          data: newUserData
        })
        
        console.log('自动创建用户记录成功，用户ID:', createResult._id)
        userInfo = { ...newUserData, _id: createResult._id }
        
        // 新创建的用户视为未绑定状态，需要完善信息
        isBound = false
        console.log('新用户已创建，openid:', openid)
        
      } catch (error) {
        console.error('自动创建用户记录失败:', error)
        // 创建失败时仍返回未绑定状态
        isBound = false
      }
    }
    
    // 检查是否为管理员
    let isAdmin = false
    try {
      const adminResult = await adminsCollection.where({
        openid: openid
      }).get()
      
      if (adminResult.data && adminResult.data.length > 0) {
        isAdmin = true
        console.log('管理员身份验证通过')
      }
    } catch (adminError) {
      console.error('查询管理员集合失败:', adminError)
      // 查询失败时默认为非管理员，保障安全
      isAdmin = false
    }
    
    return {
      openid: openid,
      appid: wxContext.APPID || '',
      unionid: wxContext.UNIONID || '',
      isBound: isBound,
      userInfo: userInfo,
      phoneNumber: phoneNumber,
      isAdmin: isAdmin,
      message: isBound ? '用户已绑定' : '用户未绑定'
    }
  } catch (error) {
    console.error('获取用户绑定状态失败', error)
    return {
      openid: '',
      appid: '',
      unionid: '',
      isBound: false,
      userInfo: null,
      isAdmin: false,
      error: error.message,
      message: '获取用户状态失败'
    }
  }
}