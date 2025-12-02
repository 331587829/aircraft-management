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
  const { id } = event

  try {
    // 验证必要参数
    if (!id) {
      return {
        success: false,
        message: '缺少飞机ID'
      }
    }

    // 先获取飞机信息，以便删除关联的图片
    const aircraftDoc = await db.collection('aircrafts').doc(id).get()
    
    if (!aircraftDoc.data) {
      return {
        success: false,
        message: '飞机不存在'
      }
    }

    const aircraft = aircraftDoc.data

    // 检查该飞机是否被用户绑定（存在isBound: true的记录）
    const bindingCheck = await db.collection('user_aircraft_relations')
      .where({
        aircraftId: id,
        isBound: true
      })
      .get()

    // 如果存在活跃的绑定关系，禁止删除
    if (bindingCheck.data.length > 0) {
      return {
        success: false,
        message: '该飞机已被用户绑定，无法删除。请先解绑所有用户后再删除。',
        boundUsers: bindingCheck.data.length
      }
    }

    // 删除飞机记录
    const result = await db.collection('aircrafts').doc(id).remove()

    // 如果飞机有关联图片，尝试删除云存储中的图片
    if (aircraft.image && aircraft.image.startsWith('cloud://')) {
      try {
        // 从云存储URL中提取文件ID
        const fileID = aircraft.image
        await cloud.deleteFile({
          fileList: [fileID]
        })
        console.log('删除飞机图片成功:', fileID)
      } catch (fileError) {
        console.error('删除飞机图片失败:', fileError)
        // 图片删除失败不影响飞机记录删除结果
      }
    }

    return {
      success: true,
      message: '删除成功',
      deleted: result.stats.removed
    }
  } catch (error) {
    console.error('删除飞机失败:', error)
    return {
      success: false,
      message: '删除失败',
      error: error.message
    }
  }
}