import { _decorator, Component, director, AudioClip, AudioSource } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('home')
export class home extends Component {
    @property(AudioClip)
    buttonClickAudio: AudioClip = null;

    private audioSource: AudioSource = null;

    start() {
        // 初始化音频源
        this.initAudioSource();
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


