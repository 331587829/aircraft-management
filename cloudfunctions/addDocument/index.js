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
    const { documentData } = event
    
    // 验证参数
    if (!documentData) {
      return {
        success: false,
        message: '文档数据不能为空'
      }
    }
    
    // 准备插入数据
    const newDocument = {
      title: documentData.title || '',
      content: documentData.content || '',
      category: documentData.category || '',
      categoryId: documentData.categoryId || '',
      permissionLevel: documentData.permissionLevel || (documentData.isPublic ? 'public' : 'vip'),
      isPublic: documentData.isPublic !== undefined ? documentData.isPublic : true,
      aircraftModel: documentData.aircraftModel || '',
      attachments: documentData.attachments || [],
      publishDate: new Date(),
      createTime: new Date(),
      updateTime: new Date(),
      _openid: openid
    }
    
    // 插入文档
    const addRes = await db.collection('documents').add({
      data: newDocument
    })
    
    return {
      success: true,
      message: '文档添加成功',
      documentId: addRes._id
    }
  } catch (err) {
    console.error('添加文档失败:', err)
    return {
      success: false,
      message: '添加文档失败',
      error: err
    }
  }
}
