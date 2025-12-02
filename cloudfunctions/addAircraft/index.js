// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  
  // 兼容两种参数格式：直接传递参数或通过data对象传递
  const data = event.data || event
  
  try {
    // 检查必填字段
    if (!data.serialNumber || !data.yearOfManufacture) {
      return {
        success: false,
        message: '序列号和生产年份为必填项'
      }
    }
    
    // 检查序列号是否已存在
    const checkResult = await db.collection('aircrafts').where({
      serialNumber: data.serialNumber
    }).get()
    
    if (checkResult.data.length > 0) {
      return {
        success: false,
        message: '该序列号已存在'
      }
    }
    
    // 添加飞机信息
    const addResult = await db.collection('aircrafts').add({
      data: {
        ...data,
        model: data.model || 'DL-2L云雁', // 如果没有提供型号，使用默认型号
        status: '运营中', // 设置默认状态为中文
        _openid: wxContext.OPENID,
        createTime: db.serverDate(),
        updateTime: db.serverDate(),
        imageUploaded: false  // 标记图片是否已上传
      }
    })
    
    return {
      success: true,
      aircraftId: addResult._id,
      message: '飞机信息添加成功'
    }
  } catch (error) {
    console.error('添加飞机失败:', error)
    return {
      success: false,
      message: '添加飞机失败，请重试',
      error: error.message
    }
  }
}