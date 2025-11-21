import { _decorator, Component, Node, director, Sprite, Label, Button, UITransform, Prefab, instantiate, SpriteFrame, Texture2D, ImageAsset } from 'cc';
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

    @property(SpriteFrame)
    defaultAvatar: SpriteFrame = null;

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
        // 从本地存储读取用户信息
        const savedUserInfo = this.getStoredUserInfo();
        if (savedUserInfo) {
            this.userInfo = savedUserInfo;
            this.updateUI();
            
            // 如果是模拟登录用户或者没有头像URL，设置默认头像
            if (!this.userInfo.avatarUrl || this.userInfo.isSimulated || this.userInfo.nickName === '示例账号') {
                this.scheduleOnce(() => {
                    this.setDefaultAvatar();
                }, 0.1);
            }
            
            console.log('从本地存储恢复登录状态');
        }
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
                    this.saveUserInfo(this.userInfo); // 保存到本地存储
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
            // 方法1：尝试使用wx.createImage加载
            if (this.wx.createImage) {
                const image = this.wx.createImage();
                image.onload = () => {
                    try {
                        // 创建ImageAsset
                        const imageAsset = new ImageAsset(image);
                        console.log('使用wx.createImage加载成功');
                        
                        // 创建Texture2D
                        const texture = new Texture2D();
                        texture.image = imageAsset;
                        
                        // 创建SpriteFrame
                        const spriteFrame = new SpriteFrame();
                        spriteFrame.texture = texture;
                        
                        // 设置到Sprite组件
                        this.avatarSprite.spriteFrame = spriteFrame;
                        console.log('头像设置成功');
                    } catch (error) {
                        console.error('使用wx.createImage创建SpriteFrame失败:', error);
                        this.tryDownloadMethod(avatarUrl);
                    }
                };
                
                image.onerror = () => {
                    console.error('wx.createImage加载失败');
                    this.tryDownloadMethod(avatarUrl);
                };
                
                image.src = avatarUrl;
            } else {
                // 如果没有wx.createImage，使用原来的downloadFile方法
                this.tryDownloadMethod(avatarUrl);
            }
        }
    }
    
    // 备用的下载文件方法
    private tryDownloadMethod(avatarUrl: string) {
        if (!this.wx) {
            this.setDefaultAvatar();
            return;
        }
        
        this.wx.downloadFile({
            url: avatarUrl,
            success: (downloadRes: any) => {
                // 将下载的临时文件转换为图片
                this.wx.getFileSystemManager().readFile({
                    filePath: downloadRes.tempFilePath,
                    success: (fileRes: any) => {
                        // 创建图片数据
                        const imageData = fileRes.data;
                        console.log('图片数据类型:', typeof imageData);
                        console.log('图片数据长度:', imageData ? imageData.length : 'undefined');
                        
                        try {
                            // 创建ImageAsset
                            const imageAsset = new ImageAsset(imageData);
                            console.log('ImageAsset创建成功');
                            
                            // 创建Texture2D
                            const texture = new Texture2D();
                            texture.image = imageAsset;
                            console.log('Texture2D创建成功');
                            
                            // 创建SpriteFrame
                            const spriteFrame = new SpriteFrame();
                            spriteFrame.texture = texture;
                            console.log('SpriteFrame创建成功');
                            
                            // 设置到Sprite组件
                            this.avatarSprite.spriteFrame = spriteFrame;
                            console.log('头像设置成功:', downloadRes.tempFilePath);
                        } catch (error) {
                            console.error('创建SpriteFrame失败:', error);
                            this.setDefaultAvatar();
                        }
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

    // 设置默认头像
    private setDefaultAvatar() {
        if (this.avatarSprite && this.defaultAvatar) {
            this.avatarSprite.spriteFrame = this.defaultAvatar;
            console.log('使用默认头像');
        } else {
            console.warn('默认头像资源未设置或avatarSprite为空');
        }
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
            avatarUrl: '', // 空字符串表示使用默认头像
            isSimulated: true // 添加标识符
        };

        // 延迟模拟登录过程
        this.scheduleOnce(() => {
            this.saveUserInfo(this.userInfo); // 保存到本地存储
            this.updateUI();
            // 直接设置默认头像
            this.setDefaultAvatar();
            this.showLoginSuccess('模拟登录成功！');
        }, 1.0);
    }

    // 退出登录
    onLogoutClick() {
        console.log('退出登录');
        
        this.userInfo = null;
        this.clearStoredUserInfo(); // 清除本地存储
        
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

    // 保存用户信息到本地存储
    private saveUserInfo(userInfo: any) {
        try {
            const userInfoStr = JSON.stringify(userInfo);
            if (this.wx && this.wx.setStorageSync) {
                // 微信小程序环境
                this.wx.setStorageSync('userInfo', userInfoStr);
            } else {
                // 开发环境或其他环境，使用localStorage
                localStorage.setItem('userInfo', userInfoStr);
            }
            console.log('用户信息已保存到本地存储');
        } catch (error) {
            console.error('保存用户信息失败:', error);
        }
    }

    // 从本地存储获取用户信息
    private getStoredUserInfo(): any {
        try {
            let userInfoStr = '';
            if (this.wx && this.wx.getStorageSync) {
                // 微信小程序环境
                userInfoStr = this.wx.getStorageSync('userInfo') || '';
            } else {
                // 开发环境或其他环境，使用localStorage
                userInfoStr = localStorage.getItem('userInfo') || '';
            }
            
            if (userInfoStr) {
                return JSON.parse(userInfoStr);
            }
            return null;
        } catch (error) {
            console.error('读取用户信息失败:', error);
            return null;
        }
    }

    // 清除本地存储的用户信息
    private clearStoredUserInfo() {
        try {
            if (this.wx && this.wx.removeStorageSync) {
                // 微信小程序环境
                this.wx.removeStorageSync('userInfo');
            } else {
                // 开发环境或其他环境，使用localStorage
                localStorage.removeItem('userInfo');
            }
            console.log('已清除本地存储的用户信息');
        } catch (error) {
            console.error('清除用户信息失败:', error);
        }
    }

    onDestroy() {
        // 清理资源
        this.unscheduleAllCallbacks();
    }
}


