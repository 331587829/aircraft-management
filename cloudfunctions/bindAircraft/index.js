// 绑定飞机到用户云函数
const cloud = require('wx-server-sdk');

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

// 获取数据库引用
const db = cloud.database();
const _ = db.command;

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    // 获取用户的openid
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    
    // 获取传入的飞机信息
    const { serialNumber, aircraftInfo } = event;
    
    console.log('绑定飞机参数:', event);
    console.log('用户openid:', openid);
    
    // 验证参数
    if (!serialNumber || typeof serialNumber !== 'string') {
      throw new Error('请提供有效的飞机序列号');
    }
    
    // 转换为大写以保持一致性
    const normalizedSerialNumber = serialNumber.toUpperCase();
    
    // 检查飞机是否已存在（同时查询serialNumber和registrationNumber字段）
    let aircraftQueryResult = await db.collection('aircrafts')
      .where(_.or([
        { serialNumber: normalizedSerialNumber },
        { registrationNumber: normalizedSerialNumber }
      ]))
      .get();
    
    let aircraftId;
    const currentTime = db.serverDate();
    
    // 如果飞机不存在，创建新飞机记录
    if (aircraftQueryResult.data.length === 0) {
      console.log('飞机不存在，创建新飞机记录');
      
      // 准备飞机数据
      const newAircraftData = {
        serialNumber: normalizedSerialNumber,
        model: aircraftInfo.model || 'DL-2L云雁', // 如果没有提供型号，使用默认型号
        manufacturer: aircraftInfo.manufacturer || '',
        year: aircraftInfo.year || '',
        status: aircraftInfo.status || '运营中', // 确保使用中文状态
        createTime: currentTime,
        updateTime: currentTime
      };
      
      // 添加其他可能的飞机信息
      if (aircraftInfo.image) {
        newAircraftData.image = aircraftInfo.image;
      }
      
      // 创建飞机记录
      const createAircraftResult = await db.collection('aircrafts').add({
        data: newAircraftData
      });
      
      console.log('创建飞机记录成功:', createAircraftResult);
      aircraftId = createAircraftResult._id;
    } else {
      // 如果飞机已存在，获取飞机ID
      console.log('飞机已存在');
      aircraftId = aircraftQueryResult.data[0]._id;
    }
    
    // 检查用户-飞机绑定关系是否已存在
    const relationQueryResult = await db.collection('user_aircraft_relations')
      .where({
        openid: openid,
        aircraftId: aircraftId,
        isBound: true
      })
      .get();
    
    let bindResult;
    
    // 如果绑定关系已存在且处于绑定状态，返回错误
    if (relationQueryResult.data.length > 0) {
      console.log('用户已经绑定了该飞机，禁止重复绑定');
      
      return {
        success: false,
        message: '您已经绑定了该飞机，无需重复绑定',
        data: null
      };
    }
    
    // 检查是否存在历史绑定记录（已解绑的记录）
    const historyRelationQuery = await db.collection('user_aircraft_relations')
      .where({
        openid: openid,
        aircraftId: aircraftId,
        isBound: false
      })
      .get();
    
    // 如果存在历史绑定记录，重新绑定
    if (historyRelationQuery.data.length > 0) {
      console.log('重新绑定用户-飞机关系');
      
      bindResult = await db.collection('user_aircraft_relations')
        .doc(historyRelationQuery.data[0]._id)
        .update({
          data: {
            bindTime: currentTime,
            isBound: true,
            unbindTime: null  // 清除解绑时间
          }
        });
    } else {
      // 如果绑定关系不存在，创建新的绑定关系
      console.log('创建新的用户-飞机绑定关系');
      
      bindResult = await db.collection('user_aircraft_relations').add({
        data: {
          openid: openid,
          aircraftId: aircraftId,
          serialNumber: normalizedSerialNumber,
          bindTime: currentTime,
          isBound: true
        }
      });
    }
    
    console.log('飞机绑定成功:', bindResult);
    
    // 返回成功结果
    return {
      success: true,
      message: '飞机绑定成功',
      data: bindResult,
      aircraftId: aircraftId
    };
    
  } catch (error) {
    console.error('绑定飞机失败', error);
    
    // 返回失败结果
    return {
      success: false,
      message: '绑定飞机失败',
      error: error.message
    };
  }
};