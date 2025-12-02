// pages/document-edit/document-edit.js
const app = getApp()

Page({
  data: {
    isEdit: false,
    documentId: null,
    title: '',
    content: '',
    attachments: [],
    categories: [
      { id: 'service_notice', name: '服务通告', icon: '📢', tags: ['服务通告'] },
      { id: 'service_letter', name: '服务信函', icon: '✉️', tags: ['服务信函'] },
      { id: 'news', name: '新闻资讯', icon: '📰', tags: ['新闻资讯'] },
      { id: 'manual', name: '技术手册', icon: '📚', tags: ['技术手册'] },
    ],
    categoryNames: ['服务通告', '服务信函', '新闻资讯', '技术手册'],
    categoryIndex: -1,
    selectedCategory: null,
    permissionLevel: 'public', // public, vip
    showCategoryModal: false,
    isSubmitting: false,
    previewHtml: '',
    previewMap: {},
    editorReady: false,
    urlMap: {}
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    if (options.id) {
      this.setData({
        isEdit: true,
        documentId: options.id
      })
      this.loadDocumentData(options.id)
    }
  },

  /**
   * 加载文档数据
   */
  loadDocumentData(id) {
    wx.showLoading({
      title: '加载中...'
    })
    
    // 调用云函数获取真实文档数据
    wx.cloud.callFunction({
      name: 'getDocumentDetail',
      data: {
        documentId: id
      },
      success: (res) => {
        wx.hideLoading()
        
        if (res.result.success) {
          const documentData = res.result.document
          
          // 查找分类索引 - 处理category字段可能是对象的情况
          const categoryId = documentData.category && documentData.category.id ? documentData.category.id : documentData.category
          const categoryIndex = this.data.categories.findIndex(cat => cat.id === categoryId)
          const selectedCategory = categoryIndex >= 0 ? this.data.categories[categoryIndex] : null
          
          this.setData({
            title: documentData.title,
            content: documentData.content,
            categoryIndex: categoryIndex >= 0 ? categoryIndex : 0,
            selectedCategory: selectedCategory,
            attachments: documentData.attachments || [],
            permissionLevel: documentData.permissionLevel || 'public'
          }, () => {
            // 如果编辑器已经准备好，立即渲染内容
            if (this.editorCtx) {
              this.renderContentToEditor()
            }
          })
        } else {
          wx.showToast({
            title: res.result.message || '获取文档失败',
            icon: 'none'
          })
        }
      },
      fail: (err) => {
        wx.hideLoading()
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none'
        })
        console.error('获取文档失败:', err)
      }
    })
  },

  /**
   * 标题输入处理
   */
  onTitleInput(e) {
    const value = e.detail.value
    this.setData({
      title: value
    })
  },

  /**
   * 内容输入处理
   */
  onContentInput(e) {
    const value = e.detail.value
    this.setData({
      content: value
    })
    this.buildPreviewHtml()
  },

  onEditorReady() {
    const q = wx.createSelectorQuery().in(this)
    q.select('#editor').context(res => {
      this.editorCtx = res.context
      this.setData({ editorReady: true })
      this.renderContentToEditor()
    }).exec()
  },

  onEditorInput(e) {
    const html = e.detail.html || ''
    const text = html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
    const hasImg = /<img/i.test(html)
    this.setData({ 
      previewHtml: html, 
      content: html, // 同步编辑器内容到content
      hasContent: !!(text || hasImg) 
    })
  },

  /**
   * 分类选择变化
   */
  onCategoryChange(e) {
    const index = e.detail.value
    const category = this.data.categories[index]
    
    if (category) {
      this.setData({
        categoryIndex: index,
        selectedCategory: category
      })
    }
  },

  setMode(e) {
    const mode = e.currentTarget.dataset.mode
    this.setData({ editingMode: mode })
  },

  insertDivider() {
    const append = '\n<hr />\n'
    this.setData({ content: (this.data.content || '') + append })
    this.buildPreviewHtml()
  },

  insertHeading() {
    const append = '\n<h2>小标题</h2>\n'
    this.setData({ content: (this.data.content || '') + append })
    this.buildPreviewHtml()
  },

  async buildPreviewHtml() {
    const html = (this.data.content || '').replace(/\n/g, '<br/>')
    const ids = []
    html.replace(/<img[^>]+src=["']([^"']+)["']/ig, (_, s) => { if (/^cloud:/.test(s)) ids.push(s) })
    if (!ids.length) { this.setData({ previewHtml: html }); return }
    try {
      const res = await wx.cloud.getTempFileURL({ fileList: ids })
      const map = {}
      ;(res.fileList || []).forEach(f => { map[f.fileID] = f.tempFileURL })
      const replaced = html.replace(/<img([^>]+)src=["']([^"']+)["']([^>]*)>/ig, (all, pre, s, post) => {
        const url = /^cloud:/.test(s) ? (map[s] || '') : s
        const styled = 'style="max-width:100%;height:auto;border-radius:12rpx"'
        return `<img${pre}src="${url || s}" ${styled}${post}>`
      })
      const mergedMap = { ...this.data.urlMap }
      Object.keys(map).forEach(fid => {
        const url = map[fid]
        mergedMap[url] = fid
        mergedMap[url.replace(/&/g,'&amp;')] = fid
      })
      this.setData({ previewHtml: replaced, urlMap: mergedMap })
    } catch (e) { this.setData({ previewHtml: html }) }
  },

  async renderContentToEditor() {
    await this.buildPreviewHtml()
    if (this.editorCtx) {
      this.editorCtx.setContents({ 
        html: this.data.previewHtml || this.data.content || '' 
      })
    }
  },

  /**
   * 设置权限级别
   */
  setPermission(e) {
    const level = e.currentTarget.dataset.level
    this.setData({
      permissionLevel: level
    })
  },

  /**
   * 添加图片
   */
  addImage() {
    if (this.data.attachments.length >= 9) {
      wx.showToast({
        title: '最多只能上传9个文件',
        icon: 'none'
      })
      return
    }

    wx.chooseMedia({
      count: 9 - this.data.attachments.length,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      maxDuration: 30,
      camera: 'back',
      success: (res) => {
        const tempFiles = res.tempFiles || []
        const newAttachments = tempFiles.map((file, index) => ({
          id: Date.now() + index,
          name: `图片${this.data.attachments.length + index + 1}`,
          type: 'image',
          size: this.formatFileSize(file.size),
          tempFilePath: file.tempFilePath,
          uploadProgress: 0
        }))
        this.uploadAttachments(newAttachments)
      }
    })
  },

  /**
   * 添加PDF
   */
  addPDF() {
    if (this.data.attachments.length >= 9) {
      wx.showToast({
        title: '最多只能上传9个文件',
        icon: 'none'
      })
      return
    }

    wx.chooseMessageFile({
      count: 9 - this.data.attachments.length,
      type: 'file',
      success: (res) => {
        const newAttachments = res.tempFiles.map((file, index) => ({
          id: Date.now() + index,
          name: file.name,
          type: 'pdf',
          size: this.formatFileSize(file.size),
          tempFilePath: file.path,
          uploadProgress: 0
        }))
        
        this.setData({
          attachments: [...this.data.attachments, ...newAttachments]
        })
        
        // 开始上传
        this.uploadAttachments(newAttachments)
      }
    })
  },

  /**
   * 上传附件
   */
  uploadAttachments(attachments) {
    attachments.forEach((attachment, index) => {
      const doUpload = (filePath) => wx.cloud.uploadFile({
        cloudPath: `documents/attachments/${Date.now()}_${index}.${attachment.type === 'image' ? 'jpg' : 'pdf'}`,
        filePath,
        success: (res) => {
          // 更新附件状态
          const updatedAttachments = this.data.attachments.map(att => {
            if (att.id === attachment.id) {
              return {
                ...att,
                cloudPath: res.fileID,
                uploadProgress: 100
              }
            }
            return att
          })
          
          this.setData({
            attachments: updatedAttachments
          })
          if (attachment.type === 'image' && res.fileID) {
            wx.cloud.getTempFileURL({ fileList: [res.fileID] }).then(r => {
              const url = (r.fileList && r.fileList[0] && r.fileList[0].tempFileURL) || ''
              const map = { ...this.data.urlMap }
              if (url) map[url] = res.fileID
              this.setData({ urlMap: map })
              if (this.editorCtx) {
                this.editorCtx.insertImage({ src: url, width: '100%', alt: attachment.name })
              } else {
                const append = `\n<img src="${url}" />`
                this.setData({ previewHtml: (this.data.previewHtml || '') + append })
              }
            })
          }
        },
        fail: (err) => {
          console.error('上传失败:', err)
          const updatedAttachments = this.data.attachments.map(att => {
            if (att.id === attachment.id) {
              return {
                ...att,
                uploadProgress: -1
              }
            }
            return att
          })
          
          this.setData({
            attachments: updatedAttachments
          })
        }
      })
      
      if (attachment.type === 'image' && attachment.tempFilePath) {
        wx.compressImage({
          src: attachment.tempFilePath,
          quality: 60,
          success: (cres) => { doUpload(cres.tempFilePath) },
          fail: () => { doUpload(attachment.tempFilePath) }
        })
      } else {
        doUpload(attachment.tempFilePath)
      }
    })
  },

  /**
   * 删除附件
   */
  removeAttachment(e) {
    const index = e.currentTarget.dataset.index
    const attachments = this.data.attachments
    attachments.splice(index, 1)
    this.setData({
      attachments: [...attachments]
    })
  },

  /**
   * 格式化文件大小
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  },

  /**
   * 保存/发布
   */
  onSave() {
    if (this.data.isSubmitting) return
    
    // 检查内容是否为空
    const hasContent = this.data.content && this.data.content.trim()
    if (!hasContent) {
      wx.showToast({
        title: '请输入内容',
        icon: 'none'
      })
      return
    }

    if (!this.data.selectedCategory) {
      wx.showToast({
        title: '请选择分类',
        icon: 'none'
      })
      return
    }

    // 构建文档数据（不依赖附件，图片直接内嵌到 content）
    const documentData = {
      title: this.data.title.trim(),
      content: '',
      category: this.data.selectedCategory,
      permissionLevel: this.data.permissionLevel,
      attachments: this.data.attachments.map(item => ({
        id: item.id,
        name: item.name,
        type: item.type,
        size: item.size,
        cloudPath: item.cloudPath
      })),
      createTime: new Date(),
      updateTime: new Date(),
      author: '系统管理员',
      isPublic: true,
      viewCount: 0,
      downloadCount: 0
    }

    wx.showLoading({
      title: this.data.isEdit ? '保存中...' : '发布中...'
    })
    this.setData({ isSubmitting: true })

    const finalizeSave = (html) => {
      const map = this.data.urlMap || {}
      const decode = (u) => (u || '').replace(/&amp;/g, '&').trim()
      const saved = html.replace(/<img([^>]+)src=["']([^"']+)["']([^>]*)>/ig, (all, pre, s, post) => {
        const key = decode(s)
        const fid = map[key] || map[s] || map[key.replace(/&/g,'&amp;')] || ''
        const src = fid || key
        return `<img${pre}src="${src}"${post}>`
      })
      documentData.content = saved
      wx.cloud.callFunction({
        name: this.data.isEdit ? 'updateDocument' : 'addDocument',
        data: this.data.isEdit ? { documentId: this.data.documentId, documentData } : { documentData },
        success: (res) => {
          wx.hideLoading()
          if (res.result && res.result.success) {
            wx.showToast({ title: this.data.isEdit ? '保存成功' : '发布成功', icon: 'success' })
            
            // 触发文档列表更新事件，通知其他页面刷新数据
            const app = getApp();
            const eventData = {
              action: this.data.isEdit ? 'update' : 'add',
              category: this.data.selectedCategory
            };
            console.log('document-edit页面触发documentListUpdated事件，数据:', eventData);
            console.log('事件系统状态 - 已注册的documentListUpdated监听器数量:', 
              app.globalEventListeners.documentListUpdated ? app.globalEventListeners.documentListUpdated.length : 0);
            
            // 确保事件正确触发
            app.emit('documentListUpdated', eventData);
            console.log('事件已触发，等待监听器响应');
            
            // 延迟返回，确保事件被处理
            setTimeout(() => { 
              // 使用redirectTo确保页面完全刷新
              const pages = getCurrentPages();
              if (pages.length > 1) {
                wx.navigateBack();
              } else {
                wx.redirectTo({
                  url: '/pages/info-management/info-management'
                });
              }
            }, 1500)
          } else {
            wx.showToast({ title: res.result.message || '操作失败', icon: 'none' })
            this.setData({ isSubmitting: false })
          }
        },
        fail: (err) => {
          wx.hideLoading()
          wx.showToast({ title: '网络错误，请重试', icon: 'none' })
          this.setData({ isSubmitting: false })
        }
      })
    }

    if (this.editorCtx) {
      this.editorCtx.getContents({ success: (res) => finalizeSave(res.html) })
    } else {
      finalizeSave(this.data.previewHtml || this.data.content)
    }
  }
})