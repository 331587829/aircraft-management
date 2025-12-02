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
    const { documentId } = event
    
    // 验证参数
    if (!documentId) {
      return {
        success: false,
        message: '文档ID不能为空'
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
    
    const document = docRes.data
    
    // 检查权限（只有文档创建者或管理员可以删除）
    if (document._openid !== openid) {
      // 这里可以添加管理员权限检查
      // 暂时允许删除，后续可以添加管理员权限验证
      console.log(`用户 ${openid} 尝试删除非自己创建的文档 ${documentId}`)
      // return {
      //   success: false,
      //   message: '没有权限删除此文档'
      // }
    }
    
    // 删除文档
    const deleteRes = await db.collection('documents').doc(documentId).remove()
    
    // 如果文档有关联文件，尝试删除云存储中的文件
    if (document.fileUrl && document.fileUrl.startsWith('cloud://')) {
      try {
        // 从云存储URL中提取文件ID
        const fileID = document.fileUrl
        await cloud.deleteFile({
          fileList: [fileID]
        })
        console.log('删除文档关联文件成功:', fileID)
      } catch (fileError) {
        console.error('删除文档关联文件失败:', fileError)
        // 文件删除失败不影响文档记录删除结果
      }
    }
    
    return {
      success: true,
      message: '文档删除成功',
      deleted: deleteRes.stats.removed
    }
  } catch (err) {
    console.error('删除文档失败:', err)
    return {
      success: false,
      message: '删除文档失败',
      error: err.message
    }
  }
}