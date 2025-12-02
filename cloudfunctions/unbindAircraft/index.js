// 解除用户与飞机的绑定关系云函数
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
    // 获取用户的openid
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    
    // 获取传入的飞机ID
    const { aircraftId } = event;
    
    console.log('解除绑定飞机参数:', event);
    console.log('用户openid:', openid);
    
    // 验证参数
    if (!aircraftId || typeof aircraftId !== 'string') {
      throw new Error('请提供有效的飞机ID');
    }
    
    // 查询用户-飞机绑定关系
    const relationQueryResult = await db.collection('user_aircraft_relations')
      .where({
        openid: openid,
        aircraftId: aircraftId
      })
      .get();
    
    console.log('用户-飞机绑定关系查询结果:', relationQueryResult);
    
    // 检查绑定关系是否存在
    if (relationQueryResult.data.length === 0) {
      throw new Error('未找到该飞机的绑定关系');
    }
    
    // 检查是否已经是解绑状态
    if (!relationQueryResult.data[0].isBound) {
      return {
        success: true,
        message: '该飞机已经处于解绑状态',
        data: relationQueryResult.data[0]
      };
    }
    
    // 更新绑定状态为false
    const unbindResult = await db.collection('user_aircraft_relations')
      .doc(relationQueryResult.data[0]._id)
      .update({
        data: {
          isBound: false,
          unbindTime: db.serverDate()
        }
      });
    
    console.log('解除绑定成功:', unbindResult);
    
    // 返回成功结果
    return {
      success: true,
      message: '解除飞机绑定成功',
      data: unbindResult
    };
    
  } catch (error) {
    console.error('解除绑定失败', error);
    
    // 返回失败结果
    return {
      success: false,
      message: '解除绑定失败',
      error: error.message
    };
  }
};