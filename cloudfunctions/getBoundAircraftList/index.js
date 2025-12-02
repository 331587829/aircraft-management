// 获取用户已绑定飞机列表云函数
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
    
    console.log('获取用户已绑定飞机列表，用户openid:', openid);
    
    // 查询用户-飞机关系集合
    const relationResult = await db.collection('user_aircraft_relations')
      .where({
        openid: openid,
        isBound: true // 只查询当前绑定的飞机
      })
      .get();
    
    console.log('用户-飞机关系查询结果:', relationResult);
    
    // 过滤掉有解绑时间的记录（逻辑上已解绑）
    // 修复：正确处理 unbindTime 为 null 的情况
    const validRelations = relationResult.data.filter(relation => {
      // unbindTime 为 null 或 undefined 表示未解绑
      // unbindTime 有值表示已解绑
      return relation.unbindTime === null || relation.unbindTime === undefined;
    });
    
    console.log('有效的绑定关系:', validRelations);
    
    // 如果没有有效的绑定关系，返回空列表
    if (validRelations.length === 0) {
      return {
        success: true,
        message: '未绑定任何飞机',
        aircraftList: []
      };
    }
    
    // 提取所有飞机ID
    const aircraftIds = validRelations.map(relation => relation.aircraftId);
    
    // 查询飞机详细信息
    const aircraftQueryResult = await db.collection('aircrafts')
      .where({
        _id: _.in(aircraftIds)
      })
      .get();
    
    console.log('飞机详细信息查询结果:', aircraftQueryResult);
    
    // 过滤掉不存在的飞机记录
    const validAircrafts = aircraftQueryResult.data.filter(aircraft => aircraft && aircraft._id);
    
    console.log('有效的飞机记录:', validAircrafts);
    
    // 获取每架飞机的详细信息
    const aircraftList = await Promise.all(validAircrafts.map(async (aircraft) => {
      
      // 处理飞机照片
      let imageUrl = '/images/aircraft-placeholder.png'; // 默认占位图
      
      if (aircraft.image) {
        try {
          // 获取图片下载链接
          const fileInfo = await cloud.getTempFileURL({
            fileList: [aircraft.image]
          });
          
          imageUrl = fileInfo.fileList[0].tempFileURL;
        } catch (imageError) {
          console.warn('获取飞机图片下载链接失败:', imageError);
          // 如果获取图片链接失败，使用默认占位图
          imageUrl = '/images/aircraft-placeholder.png';
        }
      }
      
      // 处理飞机型号，如果没有型号则使用默认型号
      const aircraftModel = aircraft.model || 'DL-2L云雁';
      
      // 简化状态显示，只显示"运营中"
      const statusText = '运营中';
      
      return {
        id: aircraft._id,
        serialNumber: aircraft.serialNumber,
        registrationNumber: aircraft.registrationNumber || '', // 添加注册号字段
        model: aircraftModel,
        manufacturer: aircraft.manufacturer,
        year: aircraft.year,
        status: statusText, // 使用固定的中文状态
        totalHours: aircraft.totalHours || 0, // 直接使用数据库中的totalHours字段
        image: imageUrl // 添加飞机照片URL
      };
    }));
    
    // 返回成功结果
    return {
      success: true,
      message: '获取已绑定飞机列表成功',
      aircraftList: aircraftList
    };
    
  } catch (error) {
    console.error('获取已绑定飞机列表失败', error);
    
    // 返回失败结果
    return {
      success: false,
      message: '获取已绑定飞机列表失败',
      error: error.message,
      aircraftList: []
    };
  }
};