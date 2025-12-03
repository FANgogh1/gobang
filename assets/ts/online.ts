import { _decorator, Component, Node, Prefab, instantiate, Vec3, UITransform, RichText, AudioClip, AudioSource, director, Director, Label, Button, Sprite, SpriteFrame, Texture2D, ImageAsset } from 'cc';
import { CloudManager, RoomData } from './CloudManager';

const { ccclass, property } = _decorator;

enum PieceType {
    EMPTY = 0,
    BLACK = 1,
    WHITE = 2
}

enum GameState {
    PLAYING = 0,
    PLAYER1_WIN = 1,
    PLAYER2_WIN = 2,
    DRAW = 3
}

@ccclass('online')
export class online extends Component {
    // UI组件
    @property(RichText)
    statusText: RichText = null;

    @property(Label)
    roomIdLabel: Label = null;

    @property(Button)
    createRoomBtn: Button = null;

    @property(Button)
    joinRoomBtn: Button = null;

    @property(Button)
    matchBtn: Button = null;

    @property(Button)
    restartBtn: Button = null;

    @property(Button)
    returnHomeBtn: Button = null;

    // 游戏组件
    @property(Prefab)
    blackPrefab: Prefab = null;

    @property(Prefab)
    whitePrefab: Prefab = null;

    @property(Node)
    boardNode: Node = null;

    @property(AudioClip)
    placePieceAudio: AudioClip = null;

    @property(AudioClip)
    buttonClickAudio: AudioClip = null;

    @property(AudioClip)
    winAudio: AudioClip = null;

    @property(AudioClip)
    loseAudio: AudioClip = null;

    // 用户信息显示组件
    @property(Sprite)
    player1Avatar: Sprite = null;

    @property(Label)
    player1Nickname: Label = null;

    @property(Sprite)
    player2Avatar: Sprite = null;

    @property(Label)
    player2Nickname: Label = null;

    @property(SpriteFrame)
    defaultAvatar: SpriteFrame = null;

    private audioSource: AudioSource = null;
    private cloudManager: CloudManager = null;

    // 棋盘配置
    private BOARD_SIZE = 15;
    private CELL_SIZE = 50;
    private BOARD_OFFSET = -350;

    // 游戏数据
    private board: number[][] = [];
    private pieces: Node[][] = [];
    private gameState: GameState = GameState.PLAYING;
    private currentPlayer: PieceType = PieceType.BLACK;

    // 联机数据
    private roomId: string = '';
    private playerId: string = '';
    private playerRole: number = 0; // 1表示房主（黑子），2表示客机（白子）
    private isMyTurn: boolean = false;
    private isShowingDialog: boolean = false; // 防止多次显示输入对话框的标志
    private isResettingGame: boolean = false; // 防止重置过程中重复操作
    private isCreatingRoom: boolean = false; // 防止重复创建房间
    private isInitialized: boolean = false; // 防止重复初始化

    // 用户信息
    private currentUserInfo: any = null;
    private opponentUserInfo: any = null;

    async start() {
        // 防止重复初始化
        if (this.isInitialized) {
            console.log('组件已初始化，跳过重复初始化');
            return;
        }

        this.isInitialized = true;
        
        this.initAudioSource();
        
        // 添加场景变化监听器
        director.on(Director.EVENT_BEFORE_SCENE_LAUNCH, () => {
            console.log('!!! 场景即将切换 !!!');
        }, this);
        
        // 创建CloudManager实例
        const cloudNode = new Node('CloudManager');
        cloudNode.parent = this.node;
        this.cloudManager = cloudNode.addComponent(CloudManager);
        
        // 设置全局实例
        (CloudManager as any).instance = this.cloudManager;
        
        // 初始化云开发
        this.updateStatusText('正在初始化云开发...');
        await this.cloudManager.initCloud();
        
        if (!this.cloudManager.isInitialized()) {
            this.updateStatusText('云开发初始化失败，请检查网络连接');
            console.error('云开发未正确初始化');
            return;
        }

        this.initGame();
        this.setupButtons();
        this.initUserInfo();
        await this.loginAndSetup();
    }

    update(deltaTime: number) {
        // 更新逻辑
    }

    // 初始化音频源
    private initAudioSource() {
        this.audioSource = this.node.addComponent(AudioSource);
        this.audioSource.volume = 0.8;
        this.audioSource.playOnAwake = false;
    }

    // 播放音效
    private playPlacePieceSound() {
        if (this.audioSource && this.placePieceAudio) {
            this.audioSource.playOneShot(this.placePieceAudio);
        }
    }

    private playButtonClickSound() {
        if (this.audioSource && this.buttonClickAudio) {
            this.audioSource.playOneShot(this.buttonClickAudio);
        }
    }

    private playWinSound() {
        if (this.audioSource && this.winAudio) {
            this.audioSource.playOneShot(this.winAudio);
        }
    }

    private playLoseSound() {
        if (this.audioSource && this.loseAudio) {
            this.audioSource.playOneShot(this.loseAudio);
        }
    }

    // 初始化游戏
    private initGame() {
        this.board = [];
        this.pieces = [];
        for (let i = 0; i < this.BOARD_SIZE; i++) {
            this.board[i] = [];
            this.pieces[i] = [];
            for (let j = 0; j < this.BOARD_SIZE; j++) {
                this.board[i][j] = PieceType.EMPTY;
                this.pieces[i][j] = null;
            }
        }

        this.gameState = GameState.PLAYING;
        this.updateStatusText('请创建房间或加入游戏');
    }

    // 设置按钮事件
    private setupButtons() {
        console.log('设置按钮事件监听器');
        
        // 先移除现有的监听器，防止重复绑定
        if (this.createRoomBtn) {
            this.createRoomBtn.node.off(Button.EventType.CLICK, this.onCreateRoomClick, this);
            this.createRoomBtn.node.on(Button.EventType.CLICK, () => {
                console.log('创建房间按钮被点击');
                this.onCreateRoomClick();
            }, this);
            console.log('创建房间按钮已绑定到 onCreateRoomClick');
        }
        if (this.joinRoomBtn) {
            this.joinRoomBtn.node.off(Button.EventType.CLICK, this.onJoinRoomClick, this);
            this.joinRoomBtn.node.on(Button.EventType.CLICK, this.onJoinRoomClick, this);
        }
        if (this.matchBtn) {
            this.matchBtn.node.off(Button.EventType.CLICK, this.onMatchClick, this);
            this.matchBtn.node.on(Button.EventType.CLICK, this.onMatchClick, this);
        }
        if (this.restartBtn) {
            this.restartBtn.node.off(Button.EventType.CLICK, this.onRestartClick, this);
            this.restartBtn.node.on(Button.EventType.CLICK, () => {
                console.log('重新开始按钮被点击');
                this.onRestartClick();
            }, this);
            console.log('重新开始按钮已绑定到 onRestartClick');
        }
        if (this.returnHomeBtn) {
            this.returnHomeBtn.node.off(Button.EventType.CLICK, this.onReturnHomeClick, this);
            this.returnHomeBtn.node.on(Button.EventType.CLICK, () => {
                console.log('返回主页按钮被点击');
                this.onReturnHomeClick();
            }, this);
            console.log('返回主页按钮已绑定到 onReturnHomeClick');
        }

        if (this.boardNode) {
            this.boardNode.off(Node.EventType.TOUCH_START, this.onBoardClick, this);
            this.boardNode.on(Node.EventType.TOUCH_START, this.onBoardClick, this);
        }
        
        // 添加键盘快捷键用于调试（开发环境）
        if (typeof window !== 'undefined' && window.location && window.location.hostname === 'localhost') {
            // 避免重复添加键盘监听器
            const existingHandler = (e: KeyboardEvent) => {
                if (e.key === 'F1') {
                    e.preventDefault();
                    this.createTestRoom();
                } else if (e.key === 'F2') {
                    e.preventDefault();
                    this.testUserInfoDisplay();
                } else if (e.key === 'F3') {
                    e.preventDefault();
                    this.testUserInfoDatabase();
                }
            };
            
            window.removeEventListener('keydown', existingHandler);
            window.addEventListener('keydown', existingHandler);
        }
    }

    // 创建测试房间（用于调试）
    private async createTestRoom() {
        if (!this.cloudManager || !this.playerId) {
            console.error('CloudManager或playerId未初始化');
            return;
        }
        
        try {
            const roomId = 'TEST123';
            console.log('创建测试房间:', roomId);
            
            await this.cloudManager.createRoom(this.playerId, 'TestHost');
            console.log('测试房间创建成功:', roomId);
            this.updateStatusText(`测试房间已创建: ${roomId}`);
        } catch (error) {
            console.error('创建测试房间失败:', error);
        }
    }

    // 测试用户信息显示（用于调试）
    private testUserInfoDisplay() {
        console.log('=== 测试用户信息显示 ===');
        
        // 测试当前用户信息显示
        if (this.currentUserInfo) {
            console.log('当前用户信息:', this.currentUserInfo);
            this.updatePlayerInfo(1, this.currentUserInfo);
            this.updatePlayerInfo(2, this.currentUserInfo);
        }
        
        // 测试默认头像设置
        if (this.player1Avatar) {
            this.setPlayerDefaultAvatar(this.player1Avatar);
            console.log('设置玩家1默认头像');
        }
        
        if (this.player2Avatar) {
            this.setPlayerDefaultAvatar(this.player2Avatar);
            console.log('设置玩家2默认头像');
        }
        
        // 测试昵称显示
        if (this.player1Nickname) {
            this.player1Nickname.string = '测试玩家1';
        }
        
        if (this.player2Nickname) {
            this.player2Nickname.string = '测试玩家2';
        }
        
        console.log('=== 测试完成 ===');
    }

    // 测试用户信息数据库保存（用于调试）
    private async testUserInfoDatabase() {
        console.log('=== 测试用户信息数据库保存 ===');
        
        if (!this.cloudManager || !this.playerId || !this.currentUserInfo) {
            console.log('缺少必要信息，跳过测试');
            return;
        }
        
        try {
            // 测试保存用户信息
            await this.cloudManager.ensurePlayerExists(
                this.playerId, 
                this.currentUserInfo.nickName || 'TestPlayer', 
                this.currentUserInfo
            );
            console.log('用户信息保存测试成功');
            
            // 测试获取用户信息
            const savedInfo = await this.cloudManager.getPlayerInfo(this.playerId);
            console.log('从数据库获取的用户信息:', savedInfo);
            
            // 测试更新显示
            if (savedInfo) {
                this.opponentUserInfo = {
                    nickName: savedInfo.nickName || savedInfo.nickname,
                    avatarUrl: savedInfo.avatarUrl
                };
                this.updatePlayerInfo(2, this.opponentUserInfo);
            }
            
            console.log('=== 数据库测试完成 ===');
        } catch (error) {
            console.error('用户信息数据库测试失败:', error);
        }
    }

    // 登录并设置
    private async loginAndSetup() {
        try {
            this.playerId = await this.cloudManager.login();
            this.updateStatusText('登录成功，请选择创建房间或加入游戏');
            
            // 登录成功后，保存用户信息到数据库
            await this.saveUserInfoToDatabase();
        } catch (error) {
            this.updateStatusText('登录失败');
            console.error('登录失败:', error);
        }
    }

    // 初始化用户信息
    private initUserInfo() {
        // 从本地存储获取用户信息（与profile.ts保持一致）
        try {
            let userInfoStr = '';
            if (typeof window !== 'undefined' && window.wx && window.wx.getStorageSync) {
                // 微信小程序环境
                userInfoStr = window.wx.getStorageSync('userInfo') || '';
            } else {
                // 开发环境或其他环境，使用localStorage
                userInfoStr = localStorage.getItem('userInfo') || '';
            }
            
            if (userInfoStr) {
                this.currentUserInfo = JSON.parse(userInfoStr);
                console.log('获取到用户信息:', this.currentUserInfo);
                
                // 显示当前用户信息（作为玩家1）
                this.updatePlayerInfo(1, this.currentUserInfo);
                
                // 将用户信息保存到数据库（如果还没有保存的话）
                this.saveUserInfoToDatabase();
            } else {
                console.log('未找到用户信息，使用默认信息');
                // 使用默认用户信息
                this.currentUserInfo = {
                    nickName: '示例账号',
                    avatarUrl: ''
                };
                this.updatePlayerInfo(1, this.currentUserInfo);
            }
        } catch (error) {
            console.error('读取用户信息失败:', error);
            // 使用默认用户信息
            this.currentUserInfo = {
                nickName: '示例账号',
                avatarUrl: ''
            };
            this.updatePlayerInfo(1, this.currentUserInfo);
        }
    }

    // 保存用户信息到数据库
    private async saveUserInfoToDatabase() {
        if (!this.currentUserInfo || !this.cloudManager || !this.playerId) {
            return;
        }
        
        try {
            // 使用CloudManager的ensurePlayerExists方法来保存用户信息
            await (this.cloudManager as any).ensurePlayerExists(
                this.playerId, 
                this.currentUserInfo.nickName || 'Player', 
                this.currentUserInfo
            );
            console.log('用户信息已保存到数据库:', this.currentUserInfo);
        } catch (error) {
            console.error('保存用户信息到数据库失败:', error);
        }
    }

    // 更新玩家信息显示
    private updatePlayerInfo(playerNumber: number, userInfo: any) {
        if (playerNumber === 1) {
            // 玩家1（房主）
            if (this.player1Nickname && userInfo.nickName) {
                this.player1Nickname.string = userInfo.nickName;
            }
            if (this.player1Avatar) {
                if (userInfo.avatarUrl && userInfo.avatarUrl !== '' && !userInfo.isSimulated) {
                    this.loadPlayerAvatar(this.player1Avatar, userInfo.avatarUrl);
                } else {
                    this.setPlayerDefaultAvatar(this.player1Avatar);
                }
            }
        } else if (playerNumber === 2) {
            // 玩家2（客机）
            if (this.player2Nickname && userInfo.nickName) {
                this.player2Nickname.string = userInfo.nickName;
            }
            if (this.player2Avatar) {
                if (userInfo.avatarUrl && userInfo.avatarUrl !== '' && !userInfo.isSimulated) {
                    this.loadPlayerAvatar(this.player2Avatar, userInfo.avatarUrl);
                } else {
                    this.setPlayerDefaultAvatar(this.player2Avatar);
                }
            }
        }
    }

    // 加载玩家头像
    private loadPlayerAvatar(avatarSprite: Sprite, avatarUrl: string) {
        if (!avatarSprite) {
            return;
        }

        // 使用微信图片加载API
        if (typeof window !== 'undefined' && window.wx) {
            // 方法1：尝试使用wx.createImage加载
            if (window.wx.createImage) {
                const image = window.wx.createImage();
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
                        avatarSprite.spriteFrame = spriteFrame;
                        console.log('玩家头像设置成功');
                    } catch (error) {
                        console.error('使用wx.createImage创建SpriteFrame失败:', error);
                        this.setPlayerDefaultAvatar(avatarSprite);
                    }
                };
                
                image.onerror = () => {
                    console.error('wx.createImage加载失败');
                    this.setPlayerDefaultAvatar(avatarSprite);
                };
                
                image.src = avatarUrl;
            } else {
                // 如果没有wx.createImage，使用原来的downloadFile方法
                this.tryDownloadPlayerAvatar(avatarSprite, avatarUrl);
            }
        } else {
            // 非微信环境，使用默认头像
            this.setPlayerDefaultAvatar(avatarSprite);
        }
    }
    
    // 备用的下载文件方法
    private tryDownloadPlayerAvatar(avatarSprite: Sprite, avatarUrl: string) {
        if (!avatarSprite || !window.wx) {
            this.setPlayerDefaultAvatar(avatarSprite);
            return;
        }
        
        window.wx.downloadFile({
            url: avatarUrl,
            success: (downloadRes: any) => {
                // 将下载的临时文件转换为图片
                window.wx.getFileSystemManager().readFile({
                    filePath: downloadRes.tempFilePath,
                    success: (fileRes: any) => {
                        // 创建图片数据
                        const imageData = fileRes.data;
                        console.log('玩家头像数据类型:', typeof imageData);
                        console.log('玩家头像数据长度:', imageData ? imageData.length : 'undefined');
                        
                        try {
                            // 创建ImageAsset
                            const imageAsset = new ImageAsset(imageData);
                            console.log('玩家头像ImageAsset创建成功');
                            
                            // 创建Texture2D
                            const texture = new Texture2D();
                            texture.image = imageAsset;
                            console.log('玩家头像Texture2D创建成功');
                            
                            // 创建SpriteFrame
                            const spriteFrame = new SpriteFrame();
                            spriteFrame.texture = texture;
                            console.log('玩家头像SpriteFrame创建成功');
                            
                            // 设置到Sprite组件
                            avatarSprite.spriteFrame = spriteFrame;
                            console.log('玩家头像设置成功:', downloadRes.tempFilePath);
                        } catch (error) {
                            console.error('创建玩家头像SpriteFrame失败:', error);
                            this.setPlayerDefaultAvatar(avatarSprite);
                        }
                    },
                    fail: (fileErr: any) => {
                        console.error('读取玩家头像文件失败:', fileErr);
                        this.setPlayerDefaultAvatar(avatarSprite);
                    }
                });
            },
            fail: (downloadErr: any) => {
                console.error('下载玩家头像失败:', downloadErr);
                this.setPlayerDefaultAvatar(avatarSprite);
            }
        });
    }

    // 设置默认头像
    private setPlayerDefaultAvatar(avatarSprite: Sprite) {
        if (avatarSprite && this.defaultAvatar) {
            avatarSprite.spriteFrame = this.defaultAvatar;
            console.log('使用默认头像');
        } else {
            console.warn('默认头像资源未设置或avatarSprite为空');
        }
    }

    // 清空玩家显示
    private clearPlayerDisplay(playerNumber: number) {
        if (playerNumber === 1) {
            // 清空玩家1显示
            if (this.player1Nickname) {
                this.player1Nickname.string = '等待玩家...';
            }
            if (this.player1Avatar && this.defaultAvatar) {
                this.player1Avatar.spriteFrame = this.defaultAvatar;
            }
            console.log('已清空玩家1显示');
        } else if (playerNumber === 2) {
            // 清空玩家2显示
            if (this.player2Nickname) {
                this.player2Nickname.string = '等待玩家...';
            }
            if (this.player2Avatar && this.defaultAvatar) {
                this.player2Avatar.spriteFrame = this.defaultAvatar;
            }
            console.log('已清空玩家2显示');
        }
    }

    // 创建房间
    private async onCreateRoomClick() {
        console.log('=== onCreateRoomClick 被调用 ===');
        console.log('当前状态 - roomId:', this.roomId, 'isCreatingRoom:', this.isCreatingRoom);
        
        // 防止重复创建房间
        if (this.roomId && this.roomId !== '') {
            console.log('已存在房间，跳过重复创建:', this.roomId);
            this.updateStatusText('已存在房间: ' + this.roomId);
            return;
        }
        
        // 防止重复点击
        if (this.isCreatingRoom) {
            console.log('正在创建房间中，忽略重复点击');
            return;
        }
        
        this.isCreatingRoom = true;
        
        try {
            console.log('开始创建房间...');
            this.playButtonClickSound();
            
            // 立即禁用按钮，防止重复点击
            if (this.createRoomBtn) {
                this.createRoomBtn.interactable = false;
            }
            
            this.roomId = await this.cloudManager.createRoom(this.playerId, this.currentUserInfo?.nickName || 'Player');
            
            console.log('房间创建成功:', this.roomId);
            
            if (this.roomIdLabel) {
                this.roomIdLabel.string = `房间号: ${this.roomId}`;
            }
            
            this.playerRole = 1; // 房主为黑子
            this.isMyTurn = true;
            
            this.updateStatusText('房间创建成功，等待对手加入...');
            this.startWatchRoom();
        } catch (error) {
            this.updateStatusText('创建房间失败');
            console.error('创建房间失败:', error);
        } finally {
            // 重新启用按钮
            if (this.createRoomBtn) {
                this.createRoomBtn.interactable = true;
            }
            this.isCreatingRoom = false;
            console.log('=== onCreateRoomClick 完成，isCreatingRoom 重置为 false ===');
        }
    }

    // 加入房间
    private async onJoinRoomClick() {
        // 防止重复点击
        if (this.joinRoomBtn) {
            this.joinRoomBtn.interactable = false;
        }
        
        try {
            // 显示输入房间号的对话框
            const roomId = await this.showRoomInputDialog();
            
            if (!roomId) {
                // 用户取消输入
                return;
            }
            
            this.playButtonClickSound();
            this.updateStatusText('正在加入房间...');
            
            const success = await this.cloudManager.joinRoom(roomId, this.playerId, this.currentUserInfo?.nickName || 'Player');
            
            if (success) {
                this.roomId = roomId;
                this.playerRole = 2; // 客机为白子
                this.isMyTurn = false;
                
                if (this.roomIdLabel) {
                    this.roomIdLabel.string = `房间号: ${roomId}`;
                }
                
                this.updateStatusText('成功加入房间，等待房主落子...');
                this.startWatchRoom();
            }
        } catch (error) {
            this.updateStatusText('加入房间失败: ' + (error.message || '房间不存在'));
            console.error('加入房间失败:', error);
        } finally {
            // 重新启用按钮
            if (this.joinRoomBtn) {
                this.joinRoomBtn.interactable = true;
            }
        }
    }

    // 显示输入房间号的对话框
    private showRoomInputDialog(): Promise<string> {
        // 防止重复显示对话框
        if (this.isShowingDialog) {
            console.log('对话框已在显示中，忽略重复调用');
            return Promise.resolve(null);
        }
        
        this.isShowingDialog = true;
        
        return new Promise((resolve) => {
            try {
                if (typeof window !== 'undefined' && window.wx && window.wx.showModal) {
                    // 使用微信小程序的模态框
                    window.wx.showModal({
                        title: '加入房间',
                        editable: true,
                        placeholderText: '请输入房间号',
                        success: (res) => {
                            this.isShowingDialog = false;
                            if (res.confirm && res.content) {
                                resolve(res.content.trim().toUpperCase());
                            } else {
                                resolve(null);
                            }
                        },
                        fail: () => {
                            this.isShowingDialog = false;
                            resolve(null);
                        }
                    });
                } else {
                    // 非微信环境，使用原生prompt
                    const roomId = prompt('请输入房间号:', '');
                    this.isShowingDialog = false;
                    if (roomId) {
                        resolve(roomId.trim().toUpperCase());
                    } else {
                        resolve(null);
                    }
                }
            } catch (error) {
                console.error('显示输入对话框时发生错误:', error);
                this.isShowingDialog = false;
                resolve(null);
            }
        });
    }

    // 匹配游戏
    private async onMatchClick() {
        try {
            this.playButtonClickSound();
            this.updateStatusText('正在匹配中...');
            
            const room = await this.cloudManager.getRandomRoom();
            if (room) {
                // 找到房间，加入
                console.log('找到可用房间，准备加入:', room.roomId);
                const success = await this.cloudManager.joinRoom(room.roomId, this.playerId, this.currentUserInfo?.nickName || 'Player');
                if (success) {
                    this.roomId = room.roomId;
                    this.playerRole = 2;
                    this.isMyTurn = false;
                    
                    if (this.roomIdLabel) {
                        this.roomIdLabel.string = `房间号: ${room.roomId}`;
                    }
                    
                    this.updateStatusText('匹配成功，等待房主落子...');
                    this.startWatchRoom();
                    
                    // 立即检查一次房间状态
                    setTimeout(async () => {
                        const updatedRoom = await this.cloudManager.getRoom(room.roomId);
                        if (updatedRoom) {
                            console.log('立即检查房间状态:', updatedRoom);
                            this.onRoomUpdate(updatedRoom);
                        }
                    }, 1000);
                }
            } else {
                // 没找到房间，创建新房间
                this.roomId = await this.cloudManager.createRoom(this.playerId, this.currentUserInfo?.nickName || 'Player');
                this.playerRole = 1;
                this.isMyTurn = true;
                
                if (this.roomIdLabel) {
                    this.roomIdLabel.string = `房间号: ${this.roomId}`;
                }
                
                this.updateStatusText('创建房间成功，等待对手加入...');
                this.startWatchRoom();
            }
        } catch (error) {
            this.updateStatusText('匹配失败');
            console.error('匹配失败:', error);
        }
    }

    // 开始监听房间
    private startWatchRoom() {
        if (!this.roomId) return;
        
        console.log('开始监听房间:', this.roomId);
        
        this.cloudManager.watchRoom(this.roomId, (room: RoomData | null) => {
            this.onRoomUpdate(room);
        });
        
        // 定期手动刷新房间状态（作为实时监听的补充）
        this.scheduleRoomRefresh();
    }
    
    // 定期刷新房间状态
    private scheduleRoomRefresh() {
        // 清除之前的定时器
        if (this.roomRefreshTimer) {
            clearInterval(this.roomRefreshTimer);
        }
        
        // 每3秒检查一次房间状态
        this.roomRefreshTimer = setInterval(async () => {
            if (this.roomId) {
                try {
                    const room = await this.cloudManager.getRoom(this.roomId);
                    if (room) {
                        console.log('定期刷新获取到房间状态:', room);
                        this.onRoomUpdate(room);
                    }
                } catch (error) {
                    console.error('定期刷新房间状态失败:', error);
                }
            }
        }, 3000);
    }
    
    private roomRefreshTimer: NodeJS.Timeout | null = null;

    // 房间状态更新
    private async onRoomUpdate(room: RoomData | null | undefined) {
        console.log('房间状态更新:', room);
        
        // 检查房间数据是否有效
        if (!room) {
            console.warn('收到空的房间数据，忽略更新');
            return;
        }
        
        // 检查必要的数据字段
        if (!room.gameState || !Array.isArray(room.gameState)) {
            console.warn('房间数据无效，gameState不是数组:', room);
            return;
        }
        
        // 更新玩家信息显示
        await this.updatePlayerDisplay(room);
        
        // 更新棋盘状态（始终更新，包括游戏结束时）
        this.board = room.gameState;
        this.updateBoardDisplay();
        
        // 更新当前玩家
        this.currentPlayer = room.currentPlayer;
        
        // 检查是否轮到自己
        this.isMyTurn = (this.playerRole === 1 && this.currentPlayer === 1) || 
                       (this.playerRole === 2 && this.currentPlayer === 2);
        
        // 更新游戏状态显示
        if (room.gameStatus === 'finished') {
            this.gameState = room.winner === this.playerRole ? GameState.PLAYER1_WIN : GameState.PLAYER2_WIN;
            const winnerText = room.winner === this.playerRole ? '你赢了！' : '你输了！';
            this.updateStatusText(winnerText);
            
            // 播放获胜或失败音效
            if (room.winner === this.playerRole) {
                this.playWinSound();
            } else {
                this.playLoseSound();
            }
            
            // 确保最终的棋盘状态被正确显示
            console.log('游戏结束，最终棋盘状态已更新');
        } else if (room.gameStatus === 'playing') {
            const myColor = this.playerRole === 1 ? '黑子' : '白子';
            this.updateStatusText(this.isMyTurn ? `轮到你了（${myColor}）` : `等待对手落子`);
        } else if (room.gameStatus === 'waiting') {
            this.updateStatusText('等待对手加入...');
        }
    }

    // 更新玩家显示信息
    private async updatePlayerDisplay(room: RoomData) {
        // 根据玩家角色确定显示位置
        if (this.playerRole === 1) {
            // 我是房主，显示在左侧
            this.updatePlayerInfo(1, this.currentUserInfo);
            
            // 显示对手信息（如果有）
            if (room.guestId && room.guestId !== '') {
                // 优先使用房间中的头像信息
                if (room.guestAvatarUrl) {
                    this.opponentUserInfo = {
                        nickName: room.guestNickname || '未知玩家',
                        avatarUrl: room.guestAvatarUrl
                    };
                } else {
                    // 从数据库获取对手的完整信息
                    const opponentInfo = await this.cloudManager.getPlayerInfo(room.guestId);
                    if (opponentInfo) {
                        this.opponentUserInfo = {
                            nickName: opponentInfo.nickName || opponentInfo.nickname || room.guestNickname,
                            avatarUrl: opponentInfo.avatarUrl || ''
                        };
                    } else {
                        // 如果数据库中没有，使用房间中的基本信息
                        this.opponentUserInfo = {
                            nickName: room.guestNickname || '未知玩家',
                            avatarUrl: ''
                        };
                    }
                }
                this.updatePlayerInfo(2, this.opponentUserInfo);
            } else {
                // 客机离开，清空客机显示
                this.clearPlayerDisplay(2);
            }
        } else if (this.playerRole === 2) {
            // 我是客机，显示在右侧
            this.updatePlayerInfo(2, this.currentUserInfo);
            
            // 显示房主信息
            if (room.hostId && room.hostId !== '') {
                // 优先使用房间中的头像信息
                if (room.hostAvatarUrl) {
                    this.opponentUserInfo = {
                        nickName: room.hostNickname || '未知玩家',
                        avatarUrl: room.hostAvatarUrl
                    };
                } else {
                    // 从数据库获取房主的完整信息
                    const opponentInfo = await this.cloudManager.getPlayerInfo(room.hostId);
                    if (opponentInfo) {
                        this.opponentUserInfo = {
                            nickName: opponentInfo.nickName || opponentInfo.nickname || room.hostNickname,
                            avatarUrl: opponentInfo.avatarUrl || ''
                        };
                    } else {
                        // 如果数据库中没有，使用房间中的基本信息
                        this.opponentUserInfo = {
                            nickName: room.hostNickname || '未知玩家',
                            avatarUrl: ''
                        };
                    }
                }
                this.updatePlayerInfo(1, this.opponentUserInfo);
            } else {
                // 房主离开，清空房主显示
                this.clearPlayerDisplay(1);
            }
        }
    }

    // 更新棋盘显示
    private updateBoardDisplay() {
        // 检查棋盘数据是否有效
        if (!this.board || !Array.isArray(this.board)) {
            console.warn('棋盘数据无效，无法更新显示');
            return;
        }
        
        console.log('更新棋盘显示，当前棋盘状态:', this.board);
        
        // 清除现有棋子
        for (let y = 0; y < this.BOARD_SIZE; y++) {
            // 确保当前行存在
            if (!this.pieces[y]) {
                this.pieces[y] = [];
            }
            
            for (let x = 0; x < this.BOARD_SIZE; x++) {
                // 确保当前位置存在
                if (!this.pieces[y][x]) {
                    this.pieces[y][x] = null;
                }
                
                // 销毁现有棋子
                if (this.pieces[y][x] && this.pieces[y][x].isValid) {
                    this.pieces[y][x].destroy();
                    this.pieces[y][x] = null;
                }
                
                // 重新创建棋子
                if (this.board[y] && this.board[y][x] !== PieceType.EMPTY) {
                    const prefab = this.board[y][x] === PieceType.BLACK ? this.blackPrefab : this.whitePrefab;
                    if (prefab) {
                        const pieceNode = instantiate(prefab);
                        const worldPos = this.boardToWorldPosition(x, y);
                        pieceNode.setPosition(worldPos);
                        this.boardNode.addChild(pieceNode);
                        this.pieces[y][x] = pieceNode;
                        
                        // 记录创建的棋子，便于调试
                        if (this.board[y][x] === PieceType.BLACK) {
                            console.log(`创建黑子 at (${x}, ${y})`);
                        } else {
                            console.log(`创建白子 at (${x}, ${y})`);
                        }
                    }
                }
            }
        }
        
        console.log('棋盘更新完成，棋子数量统计:', this.countPieces());
    }
    
    // 统计棋子数量（用于调试）
    private countPieces(): { black: number; white: number } {
        let blackCount = 0;
        let whiteCount = 0;
        
        for (let y = 0; y < this.BOARD_SIZE; y++) {
            for (let x = 0; x < this.BOARD_SIZE; x++) {
                if (this.board[y] && this.board[y][x] === PieceType.BLACK) {
                    blackCount++;
                } else if (this.board[y] && this.board[y][x] === PieceType.WHITE) {
                    whiteCount++;
                }
            }
        }
        
        return { black: blackCount, white: whiteCount };
    }

    // 棋盘点击事件
    private onBoardClick(event: any) {
        if (!this.isMyTurn || this.gameState !== GameState.PLAYING || !this.roomId) {
            return;
        }

        const touchPos = event.getUILocation();
        const localPos = this.boardNode.getComponent(UITransform).convertToNodeSpaceAR(new Vec3(touchPos.x, touchPos.y, 0));
        
        const boardX = Math.round((localPos.x - this.BOARD_OFFSET) / this.CELL_SIZE);
        const boardY = Math.round((localPos.y - this.BOARD_OFFSET) / this.CELL_SIZE);

        if (this.isValidPosition(boardX, boardY) && this.board[boardY][boardX] === PieceType.EMPTY) {
            this.placePiece(boardX, boardY);
        }
    }

    // 落子
    private async placePiece(x: number, y: number) {
        this.board[y][x] = this.currentPlayer;
        
        // 创建棋子
        const prefab = this.currentPlayer === PieceType.BLACK ? this.blackPrefab : this.whitePrefab;
        if (prefab) {
            const pieceNode = instantiate(prefab);
            const worldPos = this.boardToWorldPosition(x, y);
            pieceNode.setPosition(worldPos);
            this.boardNode.addChild(pieceNode);
            this.pieces[y][x] = pieceNode;
            
            this.playPlacePieceSound();
        }

        // 先更新游戏状态，确保最后一颗棋子被同步
        const nextPlayer = this.currentPlayer === PieceType.BLACK ? PieceType.WHITE : PieceType.BLACK;
        await this.cloudManager.updateGameState(this.roomId, this.board, nextPlayer);

        // 检查获胜
        if (this.checkWin(x, y, this.currentPlayer)) {
            // 播放获胜音效（当前玩家获胜）
            this.playWinSound();
            await this.cloudManager.finishGame(this.roomId, this.playerRole);
            return;
        }

        // 检查平局
        if (this.checkDraw()) {
            // 平局不播放特殊音效
            await this.cloudManager.finishGame(this.roomId, 0); // 0表示平局
            return;
        }
    }

    // 检查获胜
    private checkWin(x: number, y: number, pieceType: PieceType): boolean {
        const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

        for (const [dx, dy] of directions) {
            let count = 1;

            // 正向检查
            let nx = x + dx;
            let ny = y + dy;
            while (this.isValidPosition(nx, ny) && this.board[ny][nx] === pieceType) {
                count++;
                nx += dx;
                ny += dy;
            }

            // 反向检查
            nx = x - dx;
            ny = y - dy;
            while (this.isValidPosition(nx, ny) && this.board[ny][nx] === pieceType) {
                count++;
                nx -= dx;
                ny -= dy;
            }

            if (count >= 5) {
                return true;
            }
        }

        return false;
    }

    // 检查平局
    private checkDraw(): boolean {
        for (let y = 0; y < this.BOARD_SIZE; y++) {
            for (let x = 0; x < this.BOARD_SIZE; x++) {
                if (this.board[y][x] === PieceType.EMPTY) {
                    return false;
                }
            }
        }
        return true;
    }

    // 检查位置有效性
    private isValidPosition(x: number, y: number): boolean {
        return x >= 0 && x < this.BOARD_SIZE && y >= 0 && y < this.BOARD_SIZE;
    }

    // 棋盘坐标转世界坐标
    private boardToWorldPosition(x: number, y: number): Vec3 {
        const worldX = this.BOARD_OFFSET + x * this.CELL_SIZE;
        const worldY = this.BOARD_OFFSET + y * this.CELL_SIZE;
        return new Vec3(worldX, worldY, 0);
    }

    // 更新状态文本
    private updateStatusText(text: string) {
        if (this.statusText) {
            this.statusText.string = text;
        }
    }

    // 在房间内重置游戏状态
    private async resetGameInRoom() {
        try {
            // 检查房间是否存在
            if (!this.roomId || !this.cloudManager) {
                console.warn('房间不存在或CloudManager未初始化，无法重置游戏');
                return;
            }

            // 检查CloudManager是否已正确初始化
            if (!this.cloudManager.isInitialized()) {
                console.warn('CloudManager未初始化，无法重置游戏');
                return;
            }

            // 先验证房间是否仍然有效
            const currentRoom = await this.cloudManager.getRoom(this.roomId);
            if (!currentRoom) {
                console.warn('房间已不存在，无法重置游戏');
                return;
            }

            console.log('开始重置游戏状态，当前房间:', currentRoom);

            // 清空棋盘数据
            this.board = [];
            for (let i = 0; i < this.BOARD_SIZE; i++) {
                this.board[i] = [];
                for (let j = 0; j < this.BOARD_SIZE; j++) {
                    this.board[i][j] = PieceType.EMPTY;
                }
            }

            // 重置游戏状态
            this.gameState = GameState.PLAYING;
            this.currentPlayer = PieceType.BLACK;

            // 根据玩家角色设置回合
            if (this.playerRole === 1) {
                // 房主（黑子）先手
                this.isMyTurn = true;
            } else {
                // 客机（白子）后手
                this.isMyTurn = false;
            }

            // 清除棋盘上的所有棋子
            for (let y = 0; y < this.BOARD_SIZE; y++) {
                for (let x = 0; x < this.BOARD_SIZE; x++) {
                    if (this.pieces[y] && this.pieces[y][x] && this.pieces[y][x].isValid) {
                        this.pieces[y][x].destroy();
                        this.pieces[y][x] = null;
                    }
                }
            }

            // 更新云端的房间状态，包括重置gameStatus为playing
            console.log('调用云端重置游戏状态');
            await this.cloudManager.resetGameState(this.roomId, this.board, this.currentPlayer);

            // 更新状态显示
            const myColor = this.playerRole === 1 ? '黑子' : '白子';
            this.updateStatusText(this.isMyTurn ? `游戏重新开始，轮到你（${myColor}）` : `游戏重新开始，等待对手落子`);

            console.log('游戏状态重置完成');
        } catch (error) {
            console.error('重置游戏状态时发生错误:', error);
            this.updateStatusText('重置游戏失败，请重试');
        }
    }

    // 重新开始
    private async onRestartClick() {
        console.log('=== onRestartClick 被调用 ===');
        
        // 防止重复点击
        if (this.isResettingGame) {
            console.log('游戏正在重置中，忽略重复点击');
            return;
        }
        
        this.isResettingGame = true;
        this.playButtonClickSound();
        
        try {
            // 禁用所有按钮，防止意外点击
            this.setAllButtonsInteractable(false);
            
            // 延迟一小段时间，确保点击事件完全处理完毕
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // 不离开房间，只重置游戏状态
            console.log('开始调用 resetGameInRoom');
            await this.resetGameInRoom();
            console.log('=== onRestartClick 完成 ===');
        } catch (error) {
            console.error('重新开始游戏时发生错误:', error);
        } finally {
            // 重新启用按钮
            this.setAllButtonsInteractable(true);
            this.isResettingGame = false;
        }
    }

    // 返回主页
    private async onReturnHomeClick() {
        console.log('!!! onReturnHomeClick 被调用，准备返回主页 !!!');
        console.log('当前游戏状态 - isResettingGame:', this.isResettingGame);
        
        // 如果游戏正在重置，忽略返回主页点击
        if (this.isResettingGame) {
            console.log('游戏正在重置中，忽略返回主页点击');
            return;
        }
        
        this.playButtonClickSound();
        
        if (this.roomId) {
            try {
                console.log('离开房间:', this.roomId, '玩家ID:', this.playerId, '角色:', this.playerRole === 1 ? '房主' : '客机');
                await this.cloudManager.leaveRoom(this.roomId, this.playerId);
                
                if (this.playerRole === 2) {
                    console.log('客机玩家已离开房间，房间状态已重置为等待玩家加入');
                } else {
                    console.log('房主玩家已离开房间，房间已删除');
                }
            } catch (error) {
                console.error('离开房间时发生错误:', error);
            }
        }
        
        console.log('即将加载home场景');
        director.loadScene('home');
    }

    // 设置所有按钮的交互性
    private setAllButtonsInteractable(interactable: boolean) {
        console.log(`设置所有按钮交互性为: ${interactable}`);
        
        if (this.createRoomBtn) {
            this.createRoomBtn.interactable = interactable;
        }
        if (this.joinRoomBtn) {
            this.joinRoomBtn.interactable = interactable;
        }
        if (this.matchBtn) {
            this.matchBtn.interactable = interactable;
        }
        if (this.restartBtn) {
            this.restartBtn.interactable = interactable;
        }
        if (this.returnHomeBtn) {
            this.returnHomeBtn.interactable = interactable;
        }
    }

    async onDestroy() {
        console.log('销毁online组件，清理资源');
        
        // 先清理定时器，避免在资源清理过程中继续执行
        if (this.roomRefreshTimer) {
            clearInterval(this.roomRefreshTimer);
            this.roomRefreshTimer = null;
        }
        
        // 尝试离开房间
        if (this.roomId && this.cloudManager) {
            try {
                await this.cloudManager.leaveRoom(this.roomId, this.playerId);
            } catch (error) {
                console.warn('组件销毁时离开房间失败:', error);
                // 不抛出错误，避免影响组件销毁流程
            }
        }
        
        // 清理所有事件监听
        if (this.createRoomBtn && this.createRoomBtn.node && this.createRoomBtn.node.isValid) {
            this.createRoomBtn.node.off(Button.EventType.CLICK, this.onCreateRoomClick, this);
        }
        if (this.joinRoomBtn && this.joinRoomBtn.node && this.joinRoomBtn.node.isValid) {
            this.joinRoomBtn.node.off(Button.EventType.CLICK, this.onJoinRoomClick, this);
        }
        if (this.matchBtn && this.matchBtn.node && this.matchBtn.node.isValid) {
            this.matchBtn.node.off(Button.EventType.CLICK, this.onMatchClick, this);
        }
        if (this.restartBtn && this.restartBtn.node && this.restartBtn.node.isValid) {
            this.restartBtn.node.off(Button.EventType.CLICK, this.onRestartClick, this);
        }
        if (this.returnHomeBtn && this.returnHomeBtn.node && this.returnHomeBtn.node.isValid) {
            this.returnHomeBtn.node.off(Button.EventType.CLICK, this.onReturnHomeClick, this);
        }
        if (this.boardNode && this.boardNode.isValid) {
            this.boardNode.off(Node.EventType.TOUCH_START, this.onBoardClick, this);
        }
    }
}