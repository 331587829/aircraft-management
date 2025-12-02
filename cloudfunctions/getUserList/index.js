// 获取用户列表云函数
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { page = 1, pageSize = 20, keyword = '', role = '' } = event;
  
  try {
    // 验证管理员权限
    const adminCheck = await db.collection('users').where({
      openid: wxContext.OPENID,
      isAdmin: true
    }).get();
    
    if (adminCheck.data.length === 0) {
      return {
        success: false,
        message: '无权限访问'
      };
    }

    // 构建查询条件
    let match = {};
    
    // 关键词搜索（昵称或手机号）
    if (keyword) {
      match = _.or([
        {
          'wechatInfo.nickName': db.RegExp({
            regexp: keyword,
            options: 'i'
          })
        },
        {
          phoneNumber: db.RegExp({
            regexp: keyword,
            options: 'i'
          })
        },
        {
          userName: db.RegExp({
            regexp: keyword,
            options: 'i'
          })
        }
      ]);
    }
    
    // 角色筛选
    if (role) {
      if (role === 'admin') {
        match.isAdmin = true;
      } else if (role === 'user') {
        match.isAdmin = _.neq(true);
      }
    }

    // 计算总数
    const countResult = await db.collection('users').where(match).count();
    const total = countResult.total;

    // 分页查询
    const userList = await db.collection('users')
      .where(match)
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .orderBy('createTime', 'desc')
      .get();

    return {
      success: true,
      data: {
        list: userList.data,
        total: total,
        page: page,
        pageSize: pageSize
      }
    };

  } catch (error) {
    console.error('获取用户列表失败:', error);
    return {
      success: false,
      message: '获取用户列表失败',
      error: error.message
    };
  }
};