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
  const openid = wxContext.OPENID
  
  try {
    // 获取请求参数
    const { documentId, documentData } = event
    
    // 验证参数
    if (!documentId) {
      return {
        success: false,
        message: '文档ID不能为空'
      }
    }
    
    if (!documentData) {
      return {
        success: false,
        message: '文档数据不能为空'
      }
    }
    
    // 检查文档是否存在
    const docRes = await db.collection('documents').doc(documentId).get()
    
    if (!docRes.data) {
      return {
        success: false,
        message: '文档不存在'
      }
    }
    
    // 检查权限（只有文档创建者或管理员可以编辑）
    if (docRes.data._openid !== openid) {
      // 这里可以添加管理员权限检查
      return {
        success: false,
        message: '没有权限编辑此文档'
      }
    }
    
    // 准备更新数据
    const updateData = {
      title: documentData.title || docRes.data.title,
      content: documentData.content || docRes.data.content,
      category: documentData.category || docRes.data.category,
      categoryId: documentData.categoryId || docRes.data.categoryId,
      permissionLevel: documentData.permissionLevel !== undefined ? documentData.permissionLevel : (docRes.data.permissionLevel || (docRes.data.isPublic ? 'public' : 'vip')),
      tags: documentData.tags || docRes.data.tags,
      aircraftModel: documentData.aircraftModel || docRes.data.aircraftModel,
      attachments: documentData.attachments !== undefined ? documentData.attachments : (docRes.data.attachments || []),
      isPublic: documentData.isPublic !== undefined ? documentData.isPublic : docRes.data.isPublic,
      updateTime: new Date()
    }
    
    // 更新文档
    const updateRes = await db.collection('documents').doc(documentId).update({
      data: updateData
    })
    
    return {
      success: true,
      message: '文档更新成功',
      documentId: documentId
    }
  } catch (err) {
    console.error('更新文档失败:', err)
    return {
      success: false,
      message: '更新文档失败',
      error: err
    }
  }
}
