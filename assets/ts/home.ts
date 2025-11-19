import { _decorator, Component, director } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('home')
export class home extends Component {
    start() {
        // 组件启动时的初始化逻辑
    }

    update(deltaTime: number) {
        // 每帧更新逻辑
    }

    // 双人对战按钮点击事件
    onBattleButtonClick() {
        console.log('双人对战按钮被点击');
        this.loadScene('game');
    }

    // 趣味模式按钮点击事件
    onFunModeButtonClick() {
        console.log('趣味模式按钮被点击');
        this.loadScene('funmode');
    }

    // AI对战按钮点击事件
    onAiBattleButtonClick() {
        console.log('AI对战按钮被点击');
        this.loadScene('ai-battle');
    }

    // 个人中心按钮点击事件
    onProfileButtonClick() {
        console.log('个人中心按钮被点击');
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


