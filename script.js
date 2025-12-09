// 实验主逻辑控制
class ExperimentManager {
    constructor() {
        this.participantData = {
            id: '',
            age: '',
            gender: '',
            major: '',
            consent: false,
            startTime: null,
            taskTimes: {}
        };
        
        this.initializeEventListeners();
        this.loadSavedData();
    }
    
    initializeEventListeners() {
        // 同意书复选框
        const consentCheckbox = document.getElementById('consent-checkbox');
        const startButton = document.getElementById('start-experiment');
        
        if (consentCheckbox && startButton) {
            consentCheckbox.addEventListener('change', (e) => {
                this.participantData.consent = e.target.checked;
                startButton.disabled = !this.validateForm();
                this.saveData();
            });
        }
        
        // 参与者信息输入
        const participantIdInput = document.getElementById('participant-id');
        const ageInput = document.getElementById('age');
        const majorInput = document.getElementById('major');
        const genderInputs = document.querySelectorAll('input[name="gender"]');
        
        const inputs = [participantIdInput, ageInput, majorInput];
        inputs.forEach(input => {
            if (input) {
                input.addEventListener('input', () => {
                    this.updateParticipantData();
                    if (startButton) {
                        startButton.disabled = !this.validateForm();
                    }
                    this.saveData();
                });
            }
        });
        
        genderInputs.forEach(input => {
            input.addEventListener('change', () => {
                this.updateParticipantData();
                if (startButton) {
                    startButton.disabled = !this.validateForm();
                }
                this.saveData();
            });
        });
        
        // 开始实验按钮
        if (startButton) {
            startButton.addEventListener('click', () => {
                if (this.validateForm()) {
                    this.startExperiment();
                }
            });
        }
        
        // 页面离开警告
        window.addEventListener('beforeunload', (e) => {
            if (this.participantData.startTime && !this.isExperimentComplete()) {
                e.preventDefault();
                e.returnValue = '实验尚未完成，确定要离开吗？';
            }
        });
    }
    
    updateParticipantData() {
        this.participantData.id = document.getElementById('participant-id')?.value || '';
        this.participantData.age = document.getElementById('age')?.value || '';
        this.participantData.major = document.getElementById('major')?.value || '';
        
        const genderSelected = document.querySelector('input[name="gender"]:checked');
        this.participantData.gender = genderSelected ? genderSelected.value : '';
    }
    
    validateForm() {
        return this.participantData.consent &&
               this.participantData.id.trim() !== '' &&
               this.participantData.age.trim() !== '' &&
               this.participantData.gender.trim() !== '' &&
               this.participantData.major.trim() !== '';
    }
    
    startExperiment() {
        this.participantData.startTime = new Date().toISOString();
        
        // 记录开始事件
        this.logEvent('experiment_started', {
            participantId: this.participantData.id,
            timestamp: this.participantData.startTime
        });
        
        // 跳转到第一个任务
        setTimeout(() => {
            window.location.href = 'task1.html';
        }, 500);
    }
    
    logEvent(eventType, eventData) {
        const event = {
            type: eventType,
            timestamp: new Date().toISOString(),
            data: eventData,
            participantId: this.participantData.id
        };
        
        // 保存到本地存储
        this.saveEventToLocalStorage(event);
        
        // 如果数据记录器可用，也记录到那里
        if (window.dataLogger) {
            window.dataLogger.logEvent(eventType, eventData);
        }
    }
    
    saveEventToLocalStorage(event) {
        let events = JSON.parse(localStorage.getItem('experimentEvents') || '[]');
        events.push(event);
        localStorage.setItem('experimentEvents', JSON.stringify(events));
    }
    
    saveData() {
        localStorage.setItem('participantData', JSON.stringify(this.participantData));
    }
    
    loadSavedData() {
        const savedData = localStorage.getItem('participantData');
        if (savedData) {
            this.participantData = { ...this.participantData, ...JSON.parse(savedData) };
            this.populateForm();
        }
    }
    
    populateForm() {
        if (document.getElementById('participant-id')) {
            document.getElementById('participant-id').value = this.participantData.id || '';
            document.getElementById('age').value = this.participantData.age || '';
            document.getElementById('major').value = this.participantData.major || '';
            
            if (this.participantData.gender) {
                document.getElementById(this.participantData.gender).checked = true;
            }
            
            document.getElementById('consent-checkbox').checked = this.participantData.consent || false;
            
            const startButton = document.getElementById('start-experiment');
            if (startButton) {
                startButton.disabled = !this.validateForm();
            }
        }
    }
    
    isExperimentComplete() {
        // 检查所有任务是否完成
        const tasks = ['task1', 'task2', 'task3'];
        return tasks.every(task => this.participantData.taskTimes?.[task]?.completed);
    }
    
    markTaskComplete(taskId) {
        if (!this.participantData.taskTimes) {
            this.participantData.taskTimes = {};
        }
        
        this.participantData.taskTimes[taskId] = {
            completed: true,
            completionTime: new Date().toISOString()
        };
        
        this.saveData();
        this.updateProgress();
    }
    
    updateProgress() {
        const progressFill = document.querySelector('.progress-fill');
        const progressText = document.querySelector('.progress-text');
        
        if (progressFill && progressText) {
            const tasks = ['task1', 'task2', 'task3'];
            const completedTasks = tasks.filter(task => 
                this.participantData.taskTimes?.[task]?.completed
            ).length;
            
            const progress = (completedTasks / tasks.length) * 100;
            progressFill.style.width = `${progress}%`;
            progressText.textContent = `实验进度：${Math.round(progress)}%`;
        }
    }
}

// 初始化实验管理器
let experimentManager;
document.addEventListener('DOMContentLoaded', () => {
    experimentManager = new ExperimentManager();
    
    // 检查当前页面并更新进度
    if (experimentManager.participantData.startTime) {
        experimentManager.updateProgress();
    }
});

// 全局辅助函数
function formatTime(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function generateParticipantId() {
    const prefix = 'P';
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substr(2, 3).toUpperCase();
    return `${prefix}${timestamp}${random}`;
}

// 自动生成参与者ID（可选）
document.addEventListener('DOMContentLoaded', () => {
    const participantIdInput = document.getElementById('participant-id');
    if (participantIdInput && !participantIdInput.value) {
        participantIdInput.value = generateParticipantId();
        
        if (experimentManager) {
            experimentManager.updateParticipantData();
            experimentManager.saveData();
        }
    }
});

// 导出到全局
window.ExperimentManager = ExperimentManager;
window.formatTime = formatTime;