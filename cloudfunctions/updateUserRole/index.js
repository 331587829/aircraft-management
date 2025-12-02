// 更新用户角色云函数
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { userId, isAdmin } = event;
  
  try {
    // 验证操作者是否为管理员
    const adminCheck = await db.collection('users').where({
      openid: wxContext.OPENID,
      isAdmin: true
    }).get();
    
    if (adminCheck.data.length === 0) {
      return {
        success: false,
        message: '无权限执行此操作'
      };
    }

    if (!userId) {
      return {
        success: false,
        message: '缺少用户ID'
      };
    }

    // 更新用户角色
    await db.collection('users').doc(userId).update({
      data: {
        isAdmin: isAdmin,
        updateTime: db.serverDate()
      }
    });

    return {
      success: true,
      message: '角色更新成功'
    };

  } catch (error) {
    console.error('更新用户角色失败:', error);
    return {
      success: false,
      message: '更新失败',
      error: error.message
    };
  }
};