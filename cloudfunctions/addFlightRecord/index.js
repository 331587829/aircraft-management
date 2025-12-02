// 添加飞行记录的云函数
const cloud = require('wx-server-sdk');

cloud.init({
  env: 'cloud1-8gaa4jfy4b22cd28'
});

const db = cloud.database();

/**
 * 添加飞行记录
 * 记录飞行开始时间、结束时间、时长等信息
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { aircraftId, duration, startTime, endTime, location, purpose, notes } = event;
  
  try {
    // 验证用户身份
    if (!wxContext.OPENID) {
      return {
        success: false,
        message: '用户未登录'
      };
    }

    // 验证必填参数
    if (!aircraftId || !duration || !startTime || !endTime) {
      return {
        success: false,
        message: '缺少必要参数：飞机ID、时长、开始时间、结束时间'
      };
    }

    // 验证飞机ID权限（用户必须绑定该飞机）
    const relationCheck = await db.collection('user_aircraft_relations')
      .where({
        openid: wxContext.OPENID,
        aircraftId: aircraftId
      })
      .get();
    
    if (relationCheck.data.length === 0) {
      return {
        success: false,
        message: '无权限为该飞机添加飞行记录'
      };
    }

    // 验证飞机是否存在
    const aircraftCheck = await db.collection('aircrafts')
      .where({ _id: aircraftId })
      .get();
    
    if (aircraftCheck.data.length === 0) {
      return {
        success: false,
        message: '飞机不存在'
      };
    }

    // 创建飞行记录
    const flightRecord = {
      openid: wxContext.OPENID,
      aircraftId: aircraftId,
      duration: parseFloat(duration),
      startTime: startTime,
      endTime: endTime,
      location: location || '未知地点',
      purpose: purpose || '训练飞行',
      notes: notes || '',
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    };

    // 插入飞行记录
    const result = await db.collection('flight_records').add({
      data: flightRecord
    });

    console.log('飞行记录添加成功:', result);

    // 使用聚合重新计算飞机总飞行时长，确保数据严格一致
    const $ = db.command.aggregate;
    const aggregateResult = await db.collection('flight_records')
      .aggregate()
      .match({
        aircraftId: aircraftId
      })
      .group({
        _id: '$aircraftId',
        totalDuration: $.sum('$duration')
      })
      .end();

    let newTotalHours = 0;
    if (aggregateResult.list.length > 0) {
      newTotalHours = parseFloat(aggregateResult.list[0].totalDuration.toFixed(2));
    }

    // 更新飞机总飞行时长
    await db.collection('aircrafts')
      .doc(aircraftId)
      .update({
        data: {
          totalHours: newTotalHours,
          updateTime: db.serverDate()
        }
      });

    console.log('飞机飞行时长同步成功:', {
      aircraftId: aircraftId,
      newTotalHours: newTotalHours
    });

    return {
      success: true,
      message: '飞行记录添加成功',
      data: {
        recordId: result._id,
        ...flightRecord
      }
    };
    
  } catch (error) {
    console.error('添加飞行记录失败:', error);
    return {
      success: false,
      message: '添加飞行记录失败',
      error: error.message
    };
  }
};