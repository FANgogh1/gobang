import { _decorator, Component, director, AudioClip, AudioSource, Node, Sprite, Label, SpriteFrame } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('home')
export class home extends Component {
    @property(AudioClip)
    buttonClickAudio: AudioClip = null;

    @property(AudioClip)
    backgroundMusic: AudioClip = null;

    @property(Node)
    musicToggleButton: Node = null;

    @property(Sprite)
    musicToggleSprite: Sprite = null;

    @property(SpriteFrame)
    musicOnSprite: SpriteFrame = null;

    @property(SpriteFrame)
    musicOffSprite: SpriteFrame = null;

    private audioSource: AudioSource = null;
    private backgroundMusicSource: AudioSource = null;
    private isMusicOn: boolean = true;

    start() {
        // 初始化音频源
        this.initAudioSource();
        // 初始化背景音乐
        this.initBackgroundMusic();
        // 初始化UI
        this.initMusicToggleUI();
    }

    update(deltaTime: number) {
        // 每帧更新逻辑
    }

    // 初始化音频源
    private initAudioSource() {
        this.audioSource = this.node.addComponent(AudioSource);
        this.audioSource.volume = 0.8; // 设置音量
        this.audioSource.playOnAwake = false;
    }

    // 初始化背景音乐
    private initBackgroundMusic() {
        // 创建专门的背景音乐AudioSource
        this.backgroundMusicSource = this.node.addComponent(AudioSource);
        this.backgroundMusicSource.volume = 0.5; // 背景音乐音量设置较低
        this.backgroundMusicSource.playOnAwake = false;
        this.backgroundMusicSource.loop = true; // 设置循环播放
        
        // 从本地存储读取音乐开关状态
        const savedMusicState = this.getMusicState();
        this.isMusicOn = savedMusicState !== null ? savedMusicState : true; // 默认开启
        
        // 如果音乐开启且有背景音乐文件，则播放
        if (this.isMusicOn && this.backgroundMusic) {
            this.playBackgroundMusic();
        }
    }

    // 初始化音乐开关UI
    private initMusicToggleUI() {
        this.updateMusicToggleDisplay();
    }

    // 播放背景音乐
    private playBackgroundMusic() {
        if (this.backgroundMusicSource && this.backgroundMusic && !this.backgroundMusicSource.playing) {
            this.backgroundMusicSource.clip = this.backgroundMusic;
            this.backgroundMusicSource.play();
            console.log('背景音乐开始播放');
        }
    }

    // 停止背景音乐
    private stopBackgroundMusic() {
        if (this.backgroundMusicSource && this.backgroundMusicSource.playing) {
            this.backgroundMusicSource.stop();
            console.log('背景音乐停止播放');
        }
    }

    // 更新音乐开关显示
    private updateMusicToggleDisplay() {
        if (this.musicToggleSprite) {
            if (this.isMusicOn && this.musicOnSprite) {
                this.musicToggleSprite.spriteFrame = this.musicOnSprite;
            } else if (!this.isMusicOn && this.musicOffSprite) {
                this.musicToggleSprite.spriteFrame = this.musicOffSprite;
            }
        }
    }

    // 保存音乐开关状态到本地存储
    private saveMusicState(state: boolean) {
        try {
            if (typeof wx !== 'undefined' && wx.setStorageSync) {
                // 微信小程序环境
                wx.setStorageSync('musicState', state.toString());
            } else {
                // 开发环境或其他环境，使用localStorage
                localStorage.setItem('musicState', state.toString());
            }
        } catch (error) {
            console.error('保存音乐状态失败:', error);
        }
    }

    // 从本地存储读取音乐开关状态
    private getMusicState(): boolean | null {
        try {
            let stateStr = '';
            if (typeof wx !== 'undefined' && wx.getStorageSync) {
                // 微信小程序环境
                stateStr = wx.getStorageSync('musicState') || '';
            } else {
                // 开发环境或其他环境，使用localStorage
                stateStr = localStorage.getItem('musicState') || '';
            }
            
            if (stateStr) {
                return stateStr === 'true';
            }
            return null;
        } catch (error) {
            console.error('读取音乐状态失败:', error);
            return null;
        }
    }

    // 播放按钮点击音效
    private playButtonClickSound() {
        if (this.audioSource && this.buttonClickAudio) {
            this.audioSource.playOneShot(this.buttonClickAudio);
        }
    }

    // 双人对战按钮点击事件
    onBattleButtonClick() {
        console.log('双人对战按钮被点击');
        this.playButtonClickSound();
        this.loadScene('game');
    }

    // 趣味模式按钮点击事件
    onFunModeButtonClick() {
        console.log('趣味模式按钮被点击');
        this.playButtonClickSound();
        this.loadScene('funmode');
    }

    // AI对战按钮点击事件
    onAiBattleButtonClick() {
        console.log('AI对战按钮被点击');
        this.playButtonClickSound();
        this.loadScene('ai-battle');
    }

    // 个人中心按钮点击事件
    onProfileButtonClick() {
        console.log('个人中心按钮被点击');
        this.playButtonClickSound();
        this.loadScene('profile');
    }

    // 在线对战按钮点击事件
    onOnlineBattleButtonClick() {
        console.log('在线对战按钮被点击');
        this.playButtonClickSound();
        
        // 检查用户是否登录
        if (!this.isUserLoggedIn()) {
            this.showLoginRequiredDialog();
            return;
        }
        
        this.loadScene('online');
    }

    // 音乐开关按钮点击事件
    onMusicToggleClick() {
        console.log('音乐开关按钮被点击');
        this.playButtonClickSound();
        
        // 切换音乐开关状态
        this.isMusicOn = !this.isMusicOn;
        
        // 保存状态到本地存储
        this.saveMusicState(this.isMusicOn);
        
        // 更新UI显示
        this.updateMusicToggleDisplay();
        
        // 控制音乐播放
        if (this.isMusicOn) {
            this.playBackgroundMusic();
        } else {
            this.stopBackgroundMusic();
        }
    }

    // 检查用户是否已登录
    private isUserLoggedIn(): boolean {
        try {
            let userInfoStr = '';
            if (typeof wx !== 'undefined' && wx.getStorageSync) {
                // 微信小程序环境
                userInfoStr = wx.getStorageSync('userInfo') || '';
            } else {
                // 开发环境或其他环境，使用localStorage
                userInfoStr = localStorage.getItem('userInfo') || '';
            }
            
            return userInfoStr !== '';
        } catch (error) {
            console.error('检查登录状态失败:', error);
            return false;
        }
    }

    // 显示需要登录的提示对话框
    private showLoginRequiredDialog() {
        if (typeof wx !== 'undefined' && wx.showModal) {
            // 微信小程序环境
            wx.showModal({
                title: '提示',
                content: '您还未登录，无法进入联机对战模式。\n请先到个人中心进行登录。',
                showCancel: true,
                cancelText: '返回',
                confirmText: '去登录',
                success: (res) => {
                    if (res.confirm) {
                        // 用户选择去登录，跳转到个人中心
                        this.loadScene('profile');
                    }
                }
            });
        } else {
            // 开发环境，使用原生confirm
            const result = confirm('您还未登录，无法进入联机对战模式。\n是否前往个人中心进行登录？');
            if (result) {
                this.loadScene('profile');
            }
        }
    }

    // 场景跳转方法
    private loadScene(sceneName: string) {
        director.loadScene(sceneName, (err) => {
            if (err) {
                console.error(`场景 ${sceneName} 加载失败:`, err);
            } else {
                console.log(`场景 ${sceneName} 加载成功`);
            }
        });
    }
}


