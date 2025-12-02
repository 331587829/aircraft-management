// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 云函数入口函数
exports.main = async (event, context) => {
  const { documentId } = event
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  
  console.log('云函数调用参数:', event)
  console.log('用户openid:', openid)
  
  try {
    const db = cloud.database()
    
    // 获取用户信息
    let userInfo = null
    let hasBoundAircraft = false
    
    try {
      console.log('查询用户信息，openid:', openid)
      const userRes = await db.collection('users').where({
        openid: openid
      }).get()
      
      if (userRes.data.length > 0) {
        userInfo = userRes.data[0]
        
        // 检查用户是否绑定飞机
        const aircraftRes = await db.collection('user_aircraft_relations').where({
          openid: openid,
          isBound: true
        }).get()
        
        hasBoundAircraft = aircraftRes.data.length > 0
        console.log('用户绑定飞机状态:', hasBoundAircraft)
      } else {
        console.log('用户记录不存在，openid:', openid)
      }
    } catch (err) {
      console.error('获取用户信息失败:', err)
      // 用户信息获取失败不影响文档查询，继续执行
    }
    
    // 获取文档详情
    // 支持通过_id或id字段查询
    let docRes
    try {
      console.log('尝试通过_id查询文档:', documentId)
      docRes = await db.collection('documents').where({
        _id: documentId
      }).get()
      
      console.log('通过_id查询结果数量:', docRes.data.length)
      
      if (docRes.data.length === 0) {
        console.log('尝试通过id字段查询文档:', documentId)
        // 如果通过_id没找到，尝试通过id字段查找
        docRes = await db.collection('documents').where({
          id: documentId
        }).get()
        
        console.log('通过id字段查询结果数量:', docRes.data.length)
      }
    } catch (err) {
      console.error('查询文档失败:', err)
      return {
        success: false,
        message: '查询文档失败'
      }
    }
    
    if (docRes.data.length === 0) {
      return {
        success: false,
        message: '文档不存在'
      }
    }
    
    const document = docRes.data[0]
    
    // 检查文档权限 - 如果没有permissionLevel字段，默认为public
    const permissionLevel = document.permissionLevel || 'public'
    if (permissionLevel === 'vip' && !hasBoundAircraft) {
      return {
        success: false,
        message: '此文档仅限VIP机主查看，请先绑定飞机'
      }
    }
    
    // 格式化文档数据，兼容不同的字段名
    const formattedDoc = {
      id: document._id || document.id,
      title: document.name || document.title,
      description: document.description,
      category: document.category,
      categoryName: document.categoryName || document.category,
      categoryId: document.categoryId,
      fileName: document.name || document.fileName,
      fileSize: document.fileSize,
      fileType: document.fileType || getFileType(document.name || document.fileName),
      uploadTime: document.uploadTime,
      uploader: document.uploader || '系统',
      downloadCount: document.downloadCount || 0,
      viewCount: document.viewCount || 0,
      permissionLevel: permissionLevel,
      fileUrl: document.fileUrl || document.filePath,
      aircraftModel: document.aircraftModel || '',
      tags: document.tags || [],
      content: document.content || '',
      attachments: document.attachments || [],
      // 格式化日期
      formattedDate: formatDate(document.uploadTime)
    }
    
    console.log('原始文档数据:', document)
    console.log('格式化后的文档数据:', formattedDoc)
    
    // 更新文档浏览次数
    try {
      // 使用文档的_id进行更新
      const updateData = {}
      
      // 如果文档已有viewCount字段，则增加1；否则设置为1
      if (document.viewCount !== undefined) {
        updateData.viewCount = db.command.inc(1)
      } else {
        updateData.viewCount = 1
      }
      
      await db.collection('documents').where({
        _id: document._id
      }).update(updateData)
    } catch (err) {
      console.error('更新浏览次数失败:', err)
      // 不影响主要功能，继续返回结果
    }
    
    return {
      success: true,
      document: formattedDoc,
      userRole: userInfo ? userInfo.role : 'user',
      hasBoundAircraft: hasBoundAircraft
    }
    
  } catch (err) {
    console.error('获取文档详情失败:', err)
    return {
      success: false,
      message: '获取文档详情失败',
      error: err
    }
  }
}

// 格式化日期函数
function formatDate(dateStr) {
  if (!dateStr) return ''
  
  const date = new Date(dateStr)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  
  return `${year}-${month}-${day}`
}

// 根据文件名获取文件类型
function getFileType(fileName) {
  if (!fileName) return 'unknown'
  
  const extension = fileName.split('.').pop().toLowerCase()
  
  switch (extension) {
    case 'pdf':
      return 'PDF'
    case 'doc':
    case 'docx':
      return 'Word'
    case 'xls':
    case 'xlsx':
      return 'Excel'
    case 'ppt':
    case 'pptx':
      return 'PowerPoint'
    case 'txt':
      return 'Text'
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
      return 'Image'
    default:
      return extension.toUpperCase()
  }
}
