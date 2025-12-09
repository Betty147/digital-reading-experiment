class AOIManager {
    constructor(aoiConfig, dataLogger) {
        this.aoiConfig = aoiConfig;
        this.dataLogger = dataLogger;
        this.activeAOIs = new Set();
        this.aoiTimers = {};
        this.isEnabled = true;
        
        this.initializeAOITracking();
    }
    
    initializeAOITracking() {
        if (!this.isEnabled) return;
        
        // 为每个AOI元素添加鼠标事件监听
        Object.entries(this.aoiConfig).forEach(([aoiName, config]) => {
            const element = config.id ? document.getElementById(config.id) : null;
            
            if (element) {
                this.setupElementAOITracking(element, aoiName);
            } else if (config.selector) {
                // 如果配置了CSS选择器
                const elements = document.querySelectorAll(config.selector);
                elements.forEach((el, index) => {
                    this.setupElementAOITracking(el, `${aoiName}_${index}`);
                });
            }
        });
        
        // 定时检查注视点是否在AOI内
        this.startAOICheckInterval();
        
        console.log(`AOI管理器已初始化，跟踪${Object.keys(this.aoiConfig).length}个区域`);
    }
    
    setupElementAOITracking(element, aoiId) {
        if (!element || !aoiId) return;
        
        // 计算元素位置和大小
        const rect = element.getBoundingClientRect();
        const aoiData = {
            id: aoiId,
            element: element,
            x: rect.left + window.scrollX,
            y: rect.top + window.scrollY,
            width: rect.width,
            height: rect.height,
            lastEnterTime: null,
            totalTime: 0,
            visits: 0
        };
        
        // 更新配置
        this.aoiConfig[aoiId] = { ...this.aoiConfig[aoiId], ...aoiData };
        
        // 添加视觉反馈（仅调试模式）
        if (window.debugAOI) {
            this.addAOIVisualFeedback(element, aoiId);
        }
        
        // 鼠标进入/离开事件
        element.addEventListener('mouseenter', (e) => {
            this.handleAOIEnter(aoiId, e);
        });
        
        element.addEventListener('mouseleave', (e) => {
            this.handleAOIExit(aoiId, e);
        });
        
        // 点击事件
        element.addEventListener('click', (e) => {
            this.handleAOIClick(aoiId, e);
        });
    }
    
    handleAOIEnter(aoiId, event) {
        if (!this.isEnabled || this.activeAOIs.has(aoiId)) return;
        
        const enterTime = Date.now();
        this.activeAOIs.add(aoiId);
        this.aoiTimers[aoiId] = enterTime;
        
        // 记录进入事件
        this.dataLogger.logEvent('aoi_enter', {
            aoiId: aoiId,
            aoiName: this.aoiConfig[aoiId]?.name || aoiId,
            timestamp: enterTime,
            position: { x: event.clientX, y: event.clientY }
        });
        
        // 视觉反馈
        if (window.debugAOI && this.aoiConfig[aoiId]?.element) {
            this.aoiConfig[aoiId].element.style.boxShadow = '0 0 0 2px #3498db';
        }
    }
    
    handleAOIExit(aoiId, event) {
        if (!this.isEnabled || !this.activeAOIs.has(aoiId)) return;
        
        const exitTime = Date.now();
        const enterTime = this.aoiTimers[aoiId];
        const duration = exitTime - enterTime;
        
        this.activeAOIs.delete(aoiId);
        delete this.aoiTimers[aoiId];
        
        // 更新统计数据
        if (this.aoiConfig[aoiId]) {
            this.aoiConfig[aoiId].totalTime += duration;
            this.aoiConfig[aoiId].visits++;
        }
        
        // 记录离开事件
        this.dataLogger.logEvent('aoi_exit', {
            aoiId: aoiId,
            aoiName: this.aoiConfig[aoiId]?.name || aoiId,
            timestamp: exitTime,
            duration: duration,
            totalVisits: this.aoiConfig[aoiId]?.visits || 0,
            totalTime: this.aoiConfig[aoiId]?.totalTime || 0,
            position: { x: event.clientX, y: event.clientY }
        });
        
        // 移除视觉反馈
        if (window.debugAOI && this.aoiConfig[aoiId]?.element) {
            this.aoiConfig[aoiId].element.style.boxShadow = '';
        }
    }
    
    handleAOIClick(aoiId, event) {
        if (!this.isEnabled) return;
        
        this.dataLogger.logEvent('aoi_click', {
            aoiId: aoiId,
            aoiName: this.aoiConfig[aoiId]?.name || aoiId,
            timestamp: Date.now(),
            position: { x: event.clientX, y: event.clientY },
            target: event.target.tagName,
            targetId: event.target.id || event.target.className
        });
    }
    
    startAOICheckInterval() {
        // 每100ms检查一次注视点
        this.checkInterval = setInterval(() => {
            this.checkGazeInAOIs();
        }, 100);
    }
    
    checkGazeInAOIs() {
        // 这里需要集成眼动追踪数据
        // 目前使用鼠标位置模拟
        if (window.lastGazePoint) {
            this.checkPointInAOIs(window.lastGazePoint.x, window.lastGazePoint.y);
        }
    }
    
    checkPointInAOIs(x, y) {
        Object.entries(this.aoiConfig).forEach(([aoiId, config]) => {
            if (!config.x || !config.width) return;
            
            const isInside = x >= config.x && 
                            x <= config.x + config.width &&
                            y >= config.y && 
                            y <= config.y + config.height;
            
            const wasInside = this.activeAOIs.has(aoiId);
            
            if (isInside && !wasInside) {
                // 模拟进入事件
                const simulatedEvent = {
                    clientX: x,
                    clientY: y,
                    timestamp: Date.now()
                };
                this.handleAOIEnter(aoiId, simulatedEvent);
            } else if (!isInside && wasInside) {
                // 模拟离开事件
                const simulatedEvent = {
                    clientX: x,
                    clientY: y,
                    timestamp: Date.now()
                };
                this.handleAOIExit(aoiId, simulatedEvent);
            }
        });
    }
    
    addAOIVisualFeedback(element, aoiId) {
        const highlight = document.createElement('div');
        highlight.className = 'aoi-highlight';
        highlight.style.cssText = `
            position: absolute;
            border: 2px dashed rgba(52, 152, 219, 0.5);
            pointer-events: none;
            z-index: 9999;
            background: rgba(52, 152, 219, 0.1);
        `;
        
        const updatePosition = () => {
            const rect = element.getBoundingClientRect();
            highlight.style.left = `${rect.left + window.scrollX}px`;
            highlight.style.top = `${rect.top + window.scrollY}px`;
            highlight.style.width = `${rect.width}px`;
            highlight.style.height = `${rect.height}px`;
            
            // 添加标签
            const label = highlight.querySelector('.aoi-label') || document.createElement('div');
            label.className = 'aoi-label';
            label.textContent = aoiId;
            label.style.cssText = `
                position: absolute;
                top: -20px;
                left: 0;
                background: rgba(52, 152, 219, 0.9);
                color: white;
                padding: 2px 6px;
                font-size: 10px;
                border-radius: 3px;
                white-space: nowrap;
            `;
            
            if (!highlight.querySelector('.aoi-label')) {
                highlight.appendChild(label);
            }
        };
        
        updatePosition();
        document.body.appendChild(highlight);
        
        // 窗口调整时更新位置
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition);
        
        // 保存引用以便清理
        if (!this.aoiHighlights) this.aoiHighlights = [];
        this.aoiHighlights.push({ element: highlight, update: updatePosition });
        
        // 每500ms更新一次位置
        setInterval(updatePosition, 500);
    }
    
    getAOIStatistics() {
        const stats = {};
        
        Object.entries(this.aoiConfig).forEach(([aoiId, config]) => {
            if (typeof config === 'object' && config.totalTime !== undefined) {
                stats[aoiId] = {
                    name: config.name || aoiId,
                    visits: config.visits || 0,
                    totalTime: config.totalTime || 0,
                    averageTime: config.visits > 0 ? config.totalTime / config.visits : 0,
                    currentlyActive: this.activeAOIs.has(aoiId)
                };
            }
        });
        
        return stats;
    }
    
    enable() {
        this.isEnabled = true;
        console.log('AOI跟踪已启用');
    }
    
    disable() {
        this.isEnabled = false;
        console.log('AOI跟踪已禁用');
    }
    
    clearHighlights() {
        if (this.aoiHighlights) {
            this.aoiHighlights.forEach(item => {
                if (item.element && item.element.parentNode) {
                    item.element.parentNode.removeChild(item.element);
                }
            });
            this.aoiHighlights = [];
        }
    }
    
    cleanup() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }
        
        this.clearHighlights();
        this.activeAOIs.clear();
        this.aoiTimers = {};
        
        console.log('AOI管理器已清理');
    }
}

// 导出到全局
window.AOIManager = AOIManager;

// 鼠标位置追踪（模拟眼动数据）
document.addEventListener('mousemove', (event) => {
    window.lastGazePoint = {
        x: event.clientX + window.scrollX,
        y: event.clientY + window.scrollY,
        timestamp: Date.now()
    };
    
    // 如果数据记录器存在，记录原始鼠标位置
    if (window.dataLogger) {
        window.dataLogger.logGazeData(
            window.lastGazePoint.x,
            window.lastGazePoint.y,
            new Date().toISOString(),
            0
        );
    }
});

// 调试模式开关
window.toggleAOIDebug = function() {
    window.debugAOI = !window.debugAOI;
    console.log(`AOI调试模式: ${window.debugAOI ? '开启' : '关闭'}`);
    
    if (window.aoiManager) {
        if (window.debugAOI) {
            // 重新初始化并添加视觉反馈
            window.aoiManager.clearHighlights();
            Object.entries(window.aoiManager.aoiConfig).forEach(([aoiId, config]) => {
                if (config.element) {
                    window.aoiManager.addAOIVisualFeedback(config.element, aoiId);
                }
            });
        } else {
            window.aoiManager.clearHighlights();
        }
    }
};

// 自动初始化AOI管理器
document.addEventListener('DOMContentLoaded', () => {
    // 只在任务页面初始化
    if (window.location.pathname.includes('task')) {
        // 等待页面完全加载
        setTimeout(() => {
            if (window.dataLogger && window.aoiConfig) {
                window.aoiManager = new AOIManager(window.aoiConfig, window.dataLogger);
            }
        }, 1000);
    }
});