// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { id, serialNumber, registrationNumber, yearOfManufacture, status, image } = event

  try {
    // 验证必要参数
    if (!id || !serialNumber || !yearOfManufacture) {
      return {
        success: false,
        message: '缺少必要参数'
      }
    }

    // 准备更新数据
    const updateData = {
      serialNumber: serialNumber,
      registrationNumber: registrationNumber || serialNumber, // 如果没有提供registrationNumber，则使用serialNumber
      yearOfManufacture: yearOfManufacture,
      updateTime: db.serverDate()
    }

    if (status !== undefined) {
      updateData.status = status
    }

    if (image !== undefined) {
      updateData.image = image
    }

    // 更新飞机信息
    const result = await db.collection('aircrafts').doc(id).update({
      data: updateData
    })

    return {
      success: true,
      message: '更新成功',
      updated: result.stats.updated
    }
  } catch (error) {
    console.error('更新飞机信息失败:', error)
    return {
      success: false,
      message: '更新失败',
      error: error.message
    }
  }
}