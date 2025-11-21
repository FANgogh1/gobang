import { _decorator, Component, Node, director, Sprite, Label, Button, UITransform, Prefab, instantiate } from 'cc';
const { ccclass, property } = _decorator;

// 微信小程序API类型声明
declare global {
    var wx: any;
}

@ccclass('profile')
export class profile extends Component {
    @property(Node)
    loginButton: Node = null;

    @property(Node)
    logoutButton: Node = null;

    @property(Sprite)
    avatarSprite: Sprite = null;

    @property(Label)
    nicknameLabel: Label = null;

    // 微信小程序API接口
    private wx: any = null;

    // 用户数据
    private userInfo: any = null;

    start() {
        this.initWeChatAPI();
        this.initUI();
    }

    update(deltaTime: number) {
        // 每帧更新逻辑
    }

    // 初始化微信小程序API
    private initWeChatAPI() {
        // 在微信小程序环境中获取wx对象
        if (typeof wx !== 'undefined') {
            this.wx = wx;
        } else {
            // 开发环境模拟
            console.warn('当前不在微信小程序环境');
            this.wx = null;
        }
    }

    // 初始化UI
    private initUI() {
        // 初始状态：只显示登录按钮，隐藏退出按钮
        if (this.loginButton) {
            this.loginButton.active = true;
        }
        if (this.logoutButton) {
            this.logoutButton.active = false;
        }

        // 隐藏用户信息相关元素
        if (this.avatarSprite) {
            this.avatarSprite.node.active = false;
        }
        if (this.nicknameLabel) {
            this.nicknameLabel.node.active = false;
        }

        // 检查是否已经登录
        this.checkLoginStatus();
    }

    // 检查登录状态
    private checkLoginStatus() {
        // 由于getUserProfile需要用户主动点击触发，所以这里不自动获取用户信息
        // 只需要检查是否已登录即可，用户信息需要点击登录按钮获取
    }

    // 点击登录按钮
    onLoginClick() {
        console.log('登录按钮被点击');
        
        if (!this.wx) {
            // 开发环境模拟登录
            this.simulateLogin();
            return;
        }

        // 直接使用getUserProfile获取用户信息
        this.getUserInfo();
    }

    // 获取用户信息
    private getUserInfo() {
        if (!this.wx) {
            // 非微信环境，使用模拟登录
            this.simulateLogin();
            return;
        }

        console.log('开始获取用户信息...');
        console.log('当前环境:', this.wx.getSystemInfoSync());

        // 尝试获取用户信息
        if (this.wx.getUserProfile) {
            console.log('使用getUserProfile...');
            this.wx.getUserProfile({
                desc: '用于完善用户资料', // 声明获取用户个人信息后的用途
                success: (infoRes: any) => {
                    console.log('getUserProfile获取用户信息成功:', infoRes);
                    this.userInfo = infoRes.userInfo;
                    this.updateUI();
                    this.showLoginSuccess('登录成功！');
                },
                fail: (infoErr: any) => {
                    console.log('getUserProfile失败:', infoErr);
                    this.showLoginError('获取用户信息失败，请重试');
                }
            });
        } else {
            console.log('getUserProfile不支持');
            this.showLoginError('当前版本不支持获取用户信息');
        }
    }


    // 更新UI显示
    private updateUI() {
        if (!this.userInfo) {
            return;
        }

        // 隐藏登录按钮，显示退出按钮
        if (this.loginButton) {
            this.loginButton.active = false;
        }
        if (this.logoutButton) {
            this.logoutButton.active = true;
        }

        // 显示用户信息元素
        if (this.avatarSprite) {
            this.avatarSprite.node.active = true;
            if (this.userInfo.avatarUrl) {
                this.loadAvatarImage(this.userInfo.avatarUrl);
            }
        }
        if (this.nicknameLabel) {
            this.nicknameLabel.node.active = true;
            if (this.userInfo.nickName) {
                this.nicknameLabel.string = this.userInfo.nickName;
            }
        }
    }

    // 加载头像图片
    private loadAvatarImage(avatarUrl: string) {
        if (!this.avatarSprite) {
            return;
        }

        // 使用微信图片加载API
        if (this.wx) {
            this.wx.downloadFile({
                url: avatarUrl,
                success: (downloadRes: any) => {
                    // 将下载的临时文件转换为图片
                    this.wx.getFileSystemManager().readFile({
                        filePath: downloadRes.tempFilePath,
                        success: (fileRes: any) => {
                            // 创建图片数据
                            const imageData = fileRes.data;
                            // 这里需要根据Cocos Creator的API创建SpriteFrame
                            console.log('头像加载成功:', downloadRes.tempFilePath);
                        },
                        fail: (fileErr: any) => {
                            console.error('读取头像文件失败:', fileErr);
                            this.setDefaultAvatar();
                        }
                    });
                },
                fail: (downloadErr: any) => {
                    console.error('下载头像失败:', downloadErr);
                    this.setDefaultAvatar();
                }
            });
        }
    }

    // 设置默认头像
    private setDefaultAvatar() {
        // 可以设置一个默认头像
        console.log('使用默认头像');
    }

    // 显示登录成功提示
    private showLoginSuccess(message: string) {
        // 这里可以添加一个提示文本或弹窗
        console.log(message);
        // 可以调用Toast显示
        if (this.wx) {
            this.wx.showToast({
                title: message,
                icon: 'success',
                duration: 2000
            });
        }
    }

    // 显示登录错误提示
    private showLoginError(message: string) {
        console.error(message);
        // 可以调用Toast显示错误
        if (this.wx) {
            this.wx.showToast({
                title: message,
                icon: 'none',
                duration: 2000
            });
        }
    }

    // 开发环境模拟登录
    private simulateLogin() {
        // 模拟登录数据
        this.userInfo = {
            nickName: '示例账号',
            avatarUrl: '', // 这里可以放一个测试头像URL
        };

        // 延迟模拟登录过程
        this.scheduleOnce(() => {
            this.updateUI();
            this.showLoginSuccess('模拟登录成功！');
        }, 1.0);
    }

    // 退出登录
    onLogoutClick() {
        console.log('退出登录');
        
        this.userInfo = null;
        
        // 显示登录按钮，隐藏退出按钮和用户信息
        if (this.loginButton) {
            this.loginButton.active = true;
        }
        if (this.logoutButton) {
            this.logoutButton.active = false;
        }

        // 隐藏用户信息元素
        if (this.avatarSprite) {
            this.avatarSprite.node.active = false;
        }
        if (this.nicknameLabel) {
            this.nicknameLabel.node.active = false;
            this.nicknameLabel.string = '';
        }

        this.showLoginSuccess('已退出登录');
    }

    // 返回主页
    onReturnHomeClick() {
        console.log('返回主页');
        this.loadScene('home');
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

    onDestroy() {
        // 清理资源
        this.unscheduleAllCallbacks();
    }
}


