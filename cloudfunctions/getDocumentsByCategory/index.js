// 根据分类获取文档列表云函数
const cloud = require('wx-server-sdk');

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

// 获取数据库引用
const db = cloud.database();
const _ = db.command;

// 主函数
exports.main = async (event, context) => {
  const { categoryId, categoryName, searchQuery, page = 1, pageSize = 10 } = event;

  try {
    // 参数验证 - 如果categoryId为'all'，表示获取所有文档，不需要分类参数
    if (!categoryId && !categoryName && categoryId !== 'all') {
      return {
        success: false,
        message: '分类ID或分类名称不能为空'
      };
    }

    // 构建查询条件
    let queryCondition = {};

    // 设置分类条件 - 根据实际数据库字段
    // 如果categoryId为'all'，表示获取所有文档，不添加分类过滤条件
    if (categoryId && categoryId !== 'all') {
      // 数据库中的category字段是对象，包含id和name属性
      // 直接使用category.id进行查询
      queryCondition['category.id'] = categoryId;
    }
    if (categoryName && categoryName !== 'all') {
      // 如果使用分类名称查询，使用category.name
      queryCondition['category.name'] = categoryName;
    }

    // 设置搜索条件 - 只搜索文档标题
    if (searchQuery) {
      const searchConditions = [
        { title: db.RegExp({ regexp: searchQuery, options: 'i' }) }
      ];
      
      // 如果有分类条件，需要合并搜索条件和分类条件
      if (queryCondition && Object.keys(queryCondition).length > 0) {
        queryCondition = _.and([queryCondition, _.or(searchConditions)]);
      } else {
        queryCondition = _.or(searchConditions);
      }
    }

    // 计算分页参数
    const skip = (page - 1) * pageSize;

    // 查询总数
    const totalResult = await db.collection('documents')
      .where(queryCondition)
      .count();

    // 查询文档列表
    const documentsResult = await db.collection('documents')
      .where(queryCondition)
      .skip(skip)
      .limit(pageSize)
      .orderBy('uploadTime', 'desc')
      .orderBy('createTime', 'desc')
      .get();

    // 格式化文档数据，适配前端显示
    const formattedDocuments = documentsResult.data.map(doc => {
      const docObj = typeof doc === 'string' ? JSON.parse(doc) : doc;

      // 1. 富文本摘 80 字
      const html = docObj.content || '';
      const firstText = html.replace(/<[^>]+>/g, '').trim().slice(0, 80) || '暂无描述';

      // 2. 时间兜底：uploadTime > createTime > 当前时间
      const ts = docObj.uploadTime || docObj.createTime || Date.now();

      return {
        id: docObj._id || docObj.id,
        title: docObj.title || docObj.name || '未命名文档',
        category: docObj.category || '未分类',
        categoryId: getCategoryId(docObj.category),
        description: docObj.description || firstText,   // 优先后台摘要，没有再自动摘
        aircraftModel: docObj.aircraftModel || '所有机型',
        version: docObj.version || '1.0',
        publishDate: formatDate(ts),
        fileSize: formatFileSize(docObj.fileSize),
        views: docObj.viewCount || docObj.views || 0,
        downloads: docObj.downloads || 0,
        author: docObj.author || '系统',
        permissionLevel: docObj.permissionLevel || (docObj.isPublic ? 'public' : 'vip')
      };
    });

    // 返回成功结果
    return {
      success: true,
      data: formattedDocuments,
      total: totalResult.total,
      hasMore: formattedDocuments.length === pageSize,
      page: page,
      pageSize: pageSize,
      message: '获取文档列表成功'
    };
  } catch (error) {
    console.error('获取文档列表失败:', error);
    
    // 直接返回错误信息，不使用模拟数据
    return {
      success: false,
      data: [],
      total: 0,
      hasMore: false,
      page: page,
      pageSize: pageSize,
      message: '获取文档列表失败，请检查网络连接或联系管理员'
    };
  }
};

// 根据分类名称获取分类ID
function getCategoryId(categoryName) {
  const categoryMapping = {
    '服务通告': 'service_bulletin',
    '服务信函': 'service_letter',
    '新闻资讯': 'news',
    '技术手册': 'manual'
  };
  return categoryMapping[categoryName] || categoryName || 'other';
}

// 日期格式化函数
function formatDate(date) {
  if (!date) return '未知日期';
  
  try {
    // 处理字符串日期
    if (typeof date === 'string') {
      // 处理ISO格式日期
      if (date.includes('T')) {
        const d = new Date(date);
        if (isNaN(d.getTime())) {
          return '未知日期';
        }
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      return date;
    }
    
    // 处理Date对象
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      return '未知日期';
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error('日期格式化错误:', error);
    return '未知日期';
  }
}

// 文件大小格式化
function formatFileSize(bytes) {
  if (!bytes) return '未知大小';
  
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

