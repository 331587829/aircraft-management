// 绑定用户信息云函数
const cloud = require('wx-server-sdk');

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

// 获取数据库引用
const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    // 获取微信上下文
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    
    // 获取传入的用户信息
    const { userInfo, type } = event;
    
    console.log('接收到的用户信息:', event);
    console.log('用户openid:', openid);
    
    // 检查用户信息是否存在
    if (!userInfo) {
      throw new Error('用户信息不能为空');
    }
    
    const currentTime = db.serverDate();
    
    // 根据类型处理不同的用户信息
    let userData = {};
    
    if (type === 'profile') {
      // 个人信息编辑类型
      userData = {
        openid: openid,
        wechatInfo: userInfo.wechatInfo || {},
        companyName: userInfo.companyName || '', // 公司名称
        phoneNumber: userInfo.phoneNumber || '',
        updateTime: currentTime
      };
    } else {
      // 原有的员工信息绑定类型
      userData = {
        openid: openid,
        appid: userInfo.appid || '',
        userName: userInfo.userName || '',
        employeeId: userInfo.employeeId || '',
        position: userInfo.position || '',
        department: userInfo.department || '',
        phoneNumber: userInfo.phoneNumber || '',
        lastLoginTime: currentTime,
        updateTime: currentTime,
        status: 'active'
      };
    }
    
    let result;
    
    // 使用upsert方式更新用户信息，确保用户记录存在
    // 先尝试更新现有记录
    const updateResult = await db.collection('users')
      .where({
        openid: openid
      })
      .update({
        data: userData
      });
    
    if (updateResult.stats.updated === 0) {
      // 如果没有更新任何记录，说明用户不存在，创建新记录
      userData.createTime = currentTime;
      
      result = await db.collection('users')
        .add({
          data: userData
        });
        
      console.log('用户信息创建成功', result);
    } else {
      // 更新成功
      result = updateResult;
      console.log('用户信息更新成功', result);
    }
    
    // 返回成功结果
    return {
      success: true,
      message: '用户信息保存成功',
      data: result
    };
    
  } catch (error) {
    console.error('保存用户信息失败', error);
    
    // 返回失败结果
    return {
      success: false,
      message: '保存用户信息失败',
      error: error.message
    };
  }
};