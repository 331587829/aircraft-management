// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  
  try {
    // 支持两种方式：CloudID（旧版）和 code（新版）
    if (event.cloudID) {
      // 通过CloudID获取手机号码（旧版方式）
      const result = await cloud.getOpenData({
        list: [event.cloudID]
      })
      
      console.log('解密手机号码结果:', result)
      
      if (result && result.list && result.list.length > 0 && result.list[0].data) {
        const phoneNumberData = result.list[0].data
        return {
          success: true,
          phoneNumber: phoneNumberData.phoneNumber,
          countryCode: phoneNumberData.countryCode || '+86',
          openid: wxContext.OPENID
        }
      } else {
        return {
          success: false,
          error: '无法获取手机号码数据'
        }
      }
    } else if (event.code) {
      // 通过code获取手机号码（新版方式）
      // 使用微信提供的API获取手机号码
      try {
        const result = await cloud.openapi.phonenumber.getPhoneNumber({
          code: event.code
        })
        
        if (result.errcode === 0 && result.phone_info) {
          return {
            success: true,
            phoneNumber: result.phone_info.phoneNumber,
            countryCode: result.phone_info.countryCode || '+86',
            openid: wxContext.OPENID
          }
        } else {
          return {
            success: false,
            error: `获取手机号码失败: ${result.errmsg || '未知错误'}`
          }
        }
      } catch (apiError) {
        console.error('调用微信API失败:', apiError)
        return {
          success: false,
          error: `API调用失败: ${apiError.message || '未知错误'}`
        }
      }
    } else {
      return {
        success: false,
        error: '未提供CloudID或code'
      }
    }
  } catch (error) {
    console.error('解密手机号码失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}