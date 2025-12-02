// 下载文档云函数
const cloud = require('wx-server-sdk');

// 初始化云环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

// 获取数据库引用
const db = cloud.database();
const _ = db.command;

// 文档集合名称
const DOCUMENTS_COLLECTION = 'documents';
// 用户集合名称
const USERS_COLLECTION = 'users';

// 权限配置
const PERMISSIONS = {
  admin: { canDownload: true },
  technician: { canDownload: true },
  user: { canDownload: true }
};

/**
 * 下载文档云函数
 * @param {Object} event - 事件参数
 * @param {string} event.documentId - 文档ID
 * @param {string} event.fileUrl - 文件URL（可选）
 * @returns {Object} - 返回结果
 */
exports.main = async (event, context) => {
  try {
    // 1. 获取用户信息
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    let userRole = 'user'; // 默认角色为普通用户

    // 2. 验证参数
    if (!event.documentId) {
      return {
        success: false,
        message: '文档ID不能为空'
      };
    }

    // 3. 查询用户角色信息
    try {
      const userResult = await db.collection(USERS_COLLECTION)
        .where({
          openid: openid
        })
        .field({
          role: true
        })
        .get();

      if (userResult.data && userResult.data.length > 0) {
        userRole = userResult.data[0].role || 'user';
      }
    } catch (error) {
      console.warn('查询用户信息失败，使用默认角色:', error);
      // 继续执行，使用默认角色
    }

    // 4. 查询文档信息
    let documentDetail = null;
    
    // 如果提供了fileUrl参数，则直接使用
    if (event.fileUrl) {
      documentDetail = {
        id: event.documentId,
        fileUrl: event.fileUrl
      };
    } else {
      // 否则从数据库查询文档信息
      const docResult = await db.collection(DOCUMENTS_COLLECTION)
        .where({
          id: event.documentId
        })
        .get();

      if (!docResult.data || docResult.data.length === 0) {
        return {
          success: false,
          message: '文档不存在'
        };
      }

      documentDetail = docResult.data[0];
    }

    // 5. 检查用户权限
    const userPermission = PERMISSIONS[userRole];
    if (!userPermission || !userPermission.canDownload) {
      return {
        success: false,
        message: '您没有权限下载该文档'
      };
    }

    // 6. 生成临时下载链接（如果需要）
    let downloadUrl = documentDetail.fileUrl;

    // 7. 更新文档下载次数
    try {
      await db.collection(DOCUMENTS_COLLECTION)
        .where({
          id: event.documentId
        })
        .update({
          data: {
            downloads: _.inc(1),
            updateTime: db.serverDate()
          }
        });
    } catch (error) {
      console.warn('更新下载次数失败:', error);
      // 继续执行，不影响下载功能
    }

    // 8. 记录下载日志
    try {
      await db.collection('document_download_logs').add({
        data: {
          documentId: event.documentId,
          openid: openid,
          userRole: userRole,
          downloadTime: db.serverDate(),
          ip: event.clientIP || 'unknown'
        }
      });
    } catch (error) {
      console.warn('记录下载日志失败:', error);
      // 继续执行，不影响下载功能
    }

    // 9. 返回结果
    return {
      success: true,
      message: '下载链接获取成功',
      downloadUrl: downloadUrl,
      documentId: event.documentId,
      fileSize: documentDetail.fileSize || '',
      fileName: documentDetail.fileName || documentDetail.title || `document_${event.documentId}`
    };
  } catch (error) {
    console.error('下载文档失败:', error);
    return {
      success: false,
      message: '服务器内部错误',
      error: error.message
    };
  }
};