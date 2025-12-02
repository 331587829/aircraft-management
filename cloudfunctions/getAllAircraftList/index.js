// 获取所有飞机列表云函数（后台管理使用）
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
    console.log('开始获取所有飞机列表');
    
    // 查询所有飞机记录
    const aircraftResult = await db.collection('aircrafts')
      .get();
    
    console.log('查询到飞机记录数量:', aircraftResult.data.length);
    
    // 处理每架飞机的数据
    const aircraftList = await Promise.all(aircraftResult.data.map(async (aircraft) => {
      console.log(`处理飞机 ${aircraft._id} 的数据`);
      
      // 计算该飞机的实际飞行总时长
      const flightStats = await db.collection('flight_records')
        .where({
          aircraftId: aircraft._id
        })
        .get();
      
      const calculatedTotalHours = flightStats.data.reduce((total, record) => {
        return total + (record.duration || 0);
      }, 0);
      
      console.log(`飞机 ${aircraft._id} 的计算总时长: ${calculatedTotalHours}小时`);
      
      // 使用计算值或数据库中的值
      let finalTotalHours = aircraft.totalHours > 0 ? aircraft.totalHours : calculatedTotalHours;
      
      // 如果计算值与数据库中的值不一致，更新数据库
      if (Math.abs(calculatedTotalHours - (aircraft.totalHours || 0)) > 0.01) {
        console.log(`更新飞机 ${aircraft._id} 的总飞行时长: ${calculatedTotalHours}小时`);
        await db.collection('aircrafts')
          .doc(aircraft._id)
          .update({
            data: {
              totalHours: calculatedTotalHours,
              updateTime: db.serverDate()
            }
          });
        finalTotalHours = calculatedTotalHours;
      }
      
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
        }
      }
      
      // 处理飞机型号，如果没有型号则使用默认型号
      const aircraftModel = aircraft.model || 'DL-2L云雁';
      
      // 简化状态显示
      const statusText = aircraft.status || '运营中';
      
      // 查询该飞机的绑定状态
      const relationResult = await db.collection('user_aircraft_relations')
        .where({
          aircraftId: aircraft._id,
          isBound: true,
          unbindTime: null
        })
        .get();
      
      const isBound = relationResult.data.length > 0;
      
      // 生成状态类名
      const statusClass = statusText === '运营中' ? 'active' : 'inactive';
      
      return {
        id: aircraft._id,
        _id: aircraft._id, // 添加_id字段用于wx:key
        serialNumber: aircraft.serialNumber,
        registrationNumber: aircraft.registrationNumber || '',
        model: aircraftModel,
        manufacturer: aircraft.manufacturer,
        yearOfManufacture: aircraft.yearOfManufacture || aircraft.year, // 优先使用yearOfManufacture，如果没有则使用year
        year: aircraft.yearOfManufacture || aircraft.year, // 保留year字段
        status: statusText,
        statusClass: statusClass, // 添加状态类名
        totalHours: parseFloat(finalTotalHours.toFixed(2)),
        image: imageUrl,
        createTime: aircraft.createTime,
        updateTime: aircraft.updateTime,
        isBound: isBound // 添加绑定状态
      };
    }));
    
    // 按创建时间倒序排列
    aircraftList.sort((a, b) => {
      return new Date(b.createTime) - new Date(a.createTime);
    });
    
    console.log('处理完成，返回飞机列表数量:', aircraftList.length);
    
    // 返回成功结果
    return {
      success: true,
      message: '获取所有飞机列表成功',
      aircraftList: aircraftList
    };
    
  } catch (error) {
    console.error('获取所有飞机列表失败', error);
    
    // 返回失败结果
    return {
      success: false,
      message: '获取所有飞机列表失败',
      error: error.message,
      aircraftList: []
    };
  }
};