class DataLogger {
    constructor(taskId) {
        this.taskId = taskId;
        this.participantId = this.getParticipantId();
        this.logData = {
            participantId: this.participantId,
            taskId: taskId,
            startTime: new Date().toISOString(),
            events: [],
            gazeData: [], // 预留眼动数据接口
            interactions: [],
            answers: {},
            timestamps: {},
            aoiVisits: {}
        };
        
        this.initializeDataStorage();
        this.setupAutoSave();
    }
    
    getParticipantId() {
        // 从URL参数获取
        const urlParams = new URLSearchParams(window.location.search);
        const urlId = urlParams.get('participantId');
        
        // 从本地存储获取
        const storedData = localStorage.getItem('participantData');
        const storedId = storedData ? JSON.parse(storedData).id : null;
        
        // 从全局变量获取
        const globalId = window.participantId;
        
        return urlId || storedId || globalId || 'unknown';
    }
    
    initializeDataStorage() {
        // 检查是否有旧数据
        const storageKey = `taskData_${this.participantId}_${this.taskId}`;
        const savedData = localStorage.getItem(storageKey);
        
        if (savedData) {
            try {
                this.logData = JSON.parse(savedData);
                console.log(`加载了已保存的${this.taskId}数据`);
            } catch (e) {
                console.error('加载保存数据失败:', e);
            }
        }
    }
    
    logEvent(eventType, eventData) {
        const event = {
            type: eventType,
            timestamp: new Date().toISOString(),
            timestampMs: Date.now(),
            pageX: eventData?.pageX || 0,
            pageY: eventData?.pageY || 0,
            data: eventData || {}
        };
        
        this.logData.events.push(event);
        
        // 特殊事件处理
        switch(eventType) {
            case 'page_loaded':
                this.logData.timestamps.pageLoad = event.timestamp;
                break;
            case 'task_completed':
                this.logData.timestamps.taskCompleted = event.timestamp;
                break;
            case 'answer_updated':
                if (eventData.question) {
                    this.logData.answers[eventData.question] = {
                        value: eventData.value,
                        timestamp: event.timestamp
                    };
                }
                break;
            case 'aoi_enter':
            case 'aoi_exit':
                this.trackAOIVisit(eventType, eventData);
                break;
        }
        
        // 自动保存到本地存储
        this.autoSave();
        
        return event;
    }
    
    trackAOIVisit(eventType, eventData) {
        if (!eventData.aoiId) return;
        
        const aoiId = eventData.aoiId;
        if (!this.logData.aoiVisits[aoiId]) {
            this.logData.aoiVisits[aoiId] = {
                entries: 0,
                totalTime: 0,
                lastEntry: null
            };
        }
        
        const aoi = this.logData.aoiVisits[aoiId];
        
        if (eventType === 'aoi_enter') {
            aoi.entries++;
            aoi.lastEntry = Date.now();
        } else if (eventType === 'aoi_exit' && aoi.lastEntry) {
            const duration = Date.now() - aoi.lastEntry;
            aoi.totalTime += duration;
            aoi.lastEntry = null;
        }
    }
    
    logGazeData(x, y, timestamp, validity) {
        const gazePoint = {
            x: x,
            y: y,
            timestamp: timestamp || new Date().toISOString(),
            timestampMs: Date.now(),
            validity: validity || 0 // 0=有效，1=部分有效，2=无效
        };
        
        this.logData.gazeData.push(gazePoint);
        
        // 限制数据大小，防止内存溢出
        if (this.logData.gazeData.length > 10000) {
            this.logData.gazeData = this.logData.gazeData.slice(-5000);
        }
        
        return gazePoint;
    }
    
    logInteraction(interactionType, details) {
        const interaction = {
            type: interactionType,
            timestamp: new Date().toISOString(),
            timestampMs: Date.now(),
            details: details || {}
        };
        
        this.logData.interactions.push(interaction);
        this.autoSave();
        
        return interaction;
    }
    
    logAnswer(questionId, answer, metadata = {}) {
        const answerRecord = {
            questionId: questionId,
            answer: answer,
            timestamp: new Date().toISOString(),
            metadata: metadata
        };
        
        this.logData.answers[questionId] = answerRecord;
        this.autoSave();
        
        return answerRecord;
    }
    
    setupAutoSave() {
        // 每30秒自动保存
        this.autoSaveInterval = setInterval(() => {
            this.autoSave();
        }, 30000);
        
        // 页面离开前保存
        window.addEventListener('beforeunload', () => {
            this.saveData();
        });
    }
    
    autoSave() {
        // 防抖：1秒内最多保存一次
        if (this.lastSave && (Date.now() - this.lastSave < 1000)) {
            return;
        }
        
        this.saveData();
        this.lastSave = Date.now();
    }
    
    saveData() {
        try {
            const storageKey = `taskData_${this.participantId}_${this.taskId}`;
            localStorage.setItem(storageKey, JSON.stringify(this.logData));
            
            // 同时备份到会话存储
            sessionStorage.setItem(`backup_${storageKey}`, JSON.stringify(this.logData));
            
            console.log(`数据已保存: ${storageKey}`);
            return true;
        } catch (error) {
            console.error('保存数据失败:', error);
            return false;
        }
    }
    
    exportData(format = 'json') {
        const dataToExport = {
            ...this.logData,
            exportTime: new Date().toISOString(),
            exportFormat: format
        };
        
        switch(format) {
            case 'json':
                return JSON.stringify(dataToExport, null, 2);
                
            case 'csv':
                return this.convertToCSV(dataToExport);
                
            case 'text':
                return this.convertToText(dataToExport);
                
            default:
                return dataToExport;
        }
    }
    
    convertToCSV(data) {
        // 简化版CSV转换，实际应用中可能需要更复杂的处理
        let csv = 'Timestamp,EventType,Data\n';
        
        data.events.forEach(event => {
            const row = [
                event.timestamp,
                event.type,
                JSON.stringify(event.data).replace(/"/g, '""')
            ].map(cell => `"${cell}"`).join(',');
            
            csv += row + '\n';
        });
        
        return csv;
    }
    
    convertToText(data) {
        let text = `参与者ID: ${data.participantId}\n`;
        text += `任务ID: ${data.taskId}\n`;
        text += `开始时间: ${data.startTime}\n`;
        text += `总事件数: ${data.events.length}\n\n`;
        
        text += "重要事件:\n";
        text += "----------\n";
        
        const importantEvents = data.events.filter(e => 
            ['page_loaded', 'task_completed', 'answer_updated', 'article_selected'].includes(e.type)
        );
        
        importantEvents.forEach(event => {
            text += `${event.timestamp} - ${event.type}: ${JSON.stringify(event.data)}\n`;
        });
        
        return text;
    }
    
    downloadData(filename = null) {
        if (!filename) {
            filename = `reading_assessment_${this.participantId}_${this.taskId}_${Date.now()}.json`;
        }
        
        const data = this.exportData('json');
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        return filename;
    }
    
    getStatistics() {
        const events = this.logData.events;
        const startTime = new Date(this.logData.startTime).getTime();
        const endTime = events.length > 0 ? 
            new Date(events[events.length - 1].timestamp).getTime() : 
            Date.now();
        
        return {
            participantId: this.participantId,
            taskId: this.taskId,
            duration: endTime - startTime,
            totalEvents: events.length,
            eventTypes: this.countEventTypes(),
            aoiStatistics: this.getAOIStatistics(),
            answerCount: Object.keys(this.logData.answers).length,
            gazeDataPoints: this.logData.gazeData.length
        };
    }
    
    countEventTypes() {
        const counts = {};
        this.logData.events.forEach(event => {
            counts[event.type] = (counts[event.type] || 0) + 1;
        });
        return counts;
    }
    
    getAOIStatistics() {
        const stats = {};
        
        Object.entries(this.logData.aoiVisits || {}).forEach(([aoiId, data]) => {
            stats[aoiId] = {
                entries: data.entries,
                totalTime: data.totalTime,
                averageTime: data.entries > 0 ? data.totalTime / data.entries : 0
            };
        });
        
        return stats;
    }
    
    clearData() {
        const storageKey = `taskData_${this.participantId}_${this.taskId}`;
        localStorage.removeItem(storageKey);
        sessionStorage.removeItem(`backup_${storageKey}`);
        
        this.logData.events = [];
        this.logData.gazeData = [];
        this.logData.interactions = [];
        this.logData.answers = {};
        this.logData.aoiVisits = {};
        
        console.log('数据已清空');
    }
}

// 导出到全局
window.DataLogger = DataLogger;

// 自动初始化数据记录器
document.addEventListener('DOMContentLoaded', () => {
    // 获取当前任务ID
    const path = window.location.pathname;
    let taskId = 'unknown';
    
    if (path.includes('task1')) taskId = 'task1';
    else if (path.includes('task2')) taskId = 'task2';
    else if (path.includes('task3')) taskId = 'task3';
    else if (path.includes('index')) taskId = 'index';
    else if (path.includes('results')) taskId = 'results';
    
    // 初始化数据记录器
    window.dataLogger = new DataLogger(taskId);
    
    // 记录页面加载事件
    window.dataLogger.logEvent('page_loaded', {
        url: window.location.href,
        referrer: document.referrer,
        userAgent: navigator.userAgent,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        windowSize: `${window.innerWidth}x${window.innerHeight}`
    });
    
    // 监听页面可见性变化
    document.addEventListener('visibilitychange', () => {
        window.dataLogger.logEvent('visibility_change', {
            hidden: document.hidden,
            visibilityState: document.visibilityState,
            timestamp: Date.now()
        });
    });
    
    // 监听页面卸载
    window.addEventListener('pagehide', () => {
        window.dataLogger.logEvent('page_unload', {
            timestamp: Date.now()
        });
        window.dataLogger.saveData();
    });
});