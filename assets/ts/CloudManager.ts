import { _decorator, Component } from 'cc';
const { ccclass, property } = _decorator;

declare global {
    interface Window {
        wx: any;
        cloud: any;
    }
}

export interface RoomData {
    _id?: string; // 云数据库自动生成的ID
    roomId: string;
    hostId: string;
    guestId?: string;
    gameState: number[][];
    currentPlayer: number;
    gameStatus: 'waiting' | 'playing' | 'finished';
    winner?: number;
    createTime: number;
}

export interface PlayerData {
    playerId: string;
    nickname: string;
    avatar: string;
    score: number;
}

@ccclass('CloudManager')
export class CloudManager extends Component {
    private static instance: CloudManager = null;
    private initialized: boolean = false;
    private db: any = null;
    private userDb: any = null;
    private roomDb: any = null;

    constructor() {
        super();
    }

    // 云环境配置
    private envConfig = {
        envId: 'cloud1-1gflc1ng414b1843', // 你的云环境ID
        traceUser: true
    };

    public static getInstance(): CloudManager {
        return CloudManager.instance;
    }

    async start() {
        CloudManager.instance = this;
        await this.initCloud();
    }

    // 初始化云开发
    async initCloud() {
        try {
            if (typeof window !== 'undefined' && window.wx && window.wx.cloud) {
                console.log('正在初始化微信云开发...');
                
                // 首先初始化云开发
                window.wx.cloud.init({
                    env: this.envConfig.envId,
                    traceUser: this.envConfig.traceUser
                });
                
                console.log('云开发初始化完成');
                
                // 等待一下确保云开发API可用
                await new Promise(resolve => setTimeout(resolve, 200));
                
                if (window.wx.cloud.database) {
                    this.db = window.wx.cloud.database();
                    this.userDb = this.db.collection('users');
                    this.roomDb = this.db.collection('rooms');
                    this.initialized = true;
                    console.log('微信云开发连接成功');
                } else {
                    throw new Error('云开发数据库API不可用');
                }
            } else {
                console.error('未检测到微信环境或云开发API');
                this.initialized = false;
            }
        } catch (error) {
            console.error('云开发连接失败:', error);
            this.initialized = false;
        }
    }

    // 检查是否已初始化
    isInitialized(): boolean {
        return this.initialized;
    }

    // 用户登录
    async login(): Promise<string> {
        try {
            // 检查云开发是否已初始化
            if (!this.initialized) {
                throw new Error('云开发未初始化');
            }
            
            // 优先使用微信登录获取code
            const wxLoginResult = await window.wx.login();
            if (wxLoginResult.code) {
                console.log('微信登录成功，code:', wxLoginResult.code);
                
                // 尝试调用云函数获取openid
                try {
                    const cloudResult = await window.wx.cloud.callFunction({
                        name: 'login',
                        data: { code: wxLoginResult.code }
                    });
                    
                    console.log('云函数调用结果:', cloudResult);
                    
                    if (cloudResult.result && cloudResult.result.code === 0) {
                        console.log('云函数登录成功，openid:', cloudResult.result.data.openid);
                        
                        // 检查是否为临时用户ID
                        if (cloudResult.result.data.temp) {
                            console.log('使用临时用户ID登录');
                        }
                        
                        return cloudResult.result.data.openid;
                    } else {
                        console.error('云函数返回错误:', cloudResult.result);
                        throw new Error('云函数返回错误: ' + (cloudResult.result?.message || '未知错误'));
                    }
                } catch (cloudError) {
                    console.warn('云函数调用失败，使用登录码作为用户标识:', cloudError);
                    // 云函数失败时，使用登录码生成用户ID
                    const userId = 'user_' + wxLoginResult.code;
                    return userId;
                }
            } else {
                throw new Error('微信登录失败，未获取到code');
            }
        } catch (error) {
            console.error('登录失败:', error);
            // 最后的回退方案：生成随机ID
            const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            console.log('使用临时用户ID:', tempId);
            return tempId;
        }
    }

    // 确保玩家记录存在（如果不存在则创建）
    private async ensurePlayerExists(playerId: string, nickname: string): Promise<void> {
        try {
            // 检查玩家是否已存在
            const existingPlayer = await this.userDb.where({
                playerId: playerId
            }).get();

            if (existingPlayer.data.length === 0) {
                // 玩家不存在，创建新记录
                await this.userDb.add({
                    data: {
                        playerId: playerId,
                        nickname: nickname,
                        score: 0,
                        createTime: Date.now()
                    }
                });
                console.log('创建新玩家记录:', playerId);
            } else {
                console.log('玩家记录已存在，跳过创建:', playerId);
            }
        } catch (error) {
            console.error('检查或创建玩家记录失败:', error);
            throw error;
        }
    }

    // 创建房间
    async createRoom(playerId: string, nickname: string): Promise<string> {
        try {
            // 检查数据库是否已初始化
            if (!this.initialized || !this.roomDb) {
                console.warn('房间数据库未初始化，无法创建房间');
                throw new Error('房间数据库未初始化');
            }

            // 检查该玩家是否已有房间
            const existingRoom = await this.roomDb.where({
                hostId: playerId,
                gameStatus: 'waiting'
            }).get();
            
            if (existingRoom.data.length > 0) {
                console.log('玩家已有等待中的房间:', existingRoom.data[0].roomId);
                return existingRoom.data[0].roomId;
            }

            const roomData: RoomData = {
                roomId: this.generateRoomId(),
                hostId: playerId,
                gameState: Array(15).fill(null).map(() => Array(15).fill(0)),
                currentPlayer: 1, // 1表示房主先手
                gameStatus: 'waiting',
                createTime: Date.now()
            };

            console.log('创建房间数据:', {
                roomId: roomData.roomId,
                hostId: roomData.hostId,
                gameState: roomData.gameState,
                gameStateSize: `${roomData.gameState.length}x${roomData.gameState[0]?.length || 0}`,
                currentPlayer: roomData.currentPlayer,
                gameStatus: roomData.gameStatus
            });

            await this.roomDb.add({
                data: roomData
            });

            // 确保玩家记录存在
            await this.ensurePlayerExists(playerId, nickname);

            console.log('房间创建成功:', roomData.roomId);
            return roomData.roomId;
        } catch (error) {
            console.error('创建房间失败:', error);
            throw error;
        }
    }

    // 加入房间
    async joinRoom(roomId: string, playerId: string, nickname: string): Promise<boolean> {
        try {
            console.log('尝试加入房间:', { roomId, playerId, nickname });

            // 检查数据库是否已初始化
            if (!this.initialized || !this.roomDb) {
                console.warn('房间数据库未初始化，无法加入房间');
                throw new Error('房间数据库未初始化');
            }
            
            const room = await this.getRoom(roomId);
            if (!room) {
                throw new Error('房间不存在，请检查房间号是否正确');
            }

            console.log('找到房间，检查状态:', room);

            if (room.gameStatus !== 'waiting') {
                throw new Error('房间已开始游戏或已满');
            }

            if (room.guestId && room.guestId !== playerId) {
                throw new Error('房间已满');
            }

            // 再次检查roomDb是否可用（双重保险）
            if (!this.roomDb) {
                console.warn('roomDb为null，无法加入房间');
                throw new Error('房间数据库不可用');
            }

            // 更新房间信息，添加客机玩家
            console.log('更新房间信息...');
            await this.roomDb.doc(room._id).update({
                data: {
                    guestId: playerId,
                    gameStatus: 'playing'
                }
            });

            // 确保玩家记录存在
            console.log('检查玩家信息...');
            await this.ensurePlayerExists(playerId, nickname);

            console.log('成功加入房间:', roomId);
            return true;
        } catch (error) {
            console.error('加入房间失败:', error);
            throw error;
        }
    }

    // 获取房间信息
    async getRoom(roomId: string): Promise<RoomData | null> {
        try {
            console.log('查找房间:', roomId);
            
            if (!this.initialized || !this.roomDb) {
                console.warn('房间数据库未初始化，返回null');
                return null;
            }
            
            const result = await this.roomDb.where({
                roomId: roomId
            }).get();

            console.log('房间查询结果:', {
                roomId: roomId,
                foundCount: result.data.length,
                data: result.data
            });

            if (result.data.length > 0) {
                console.log('找到房间:', result.data[0]);
                return result.data[0] as RoomData;
            }
            
            console.log('房间不存在:', roomId);
            return null;
        } catch (error) {
            console.error('获取房间信息失败:', error);
            throw error;
        }
    }

    // 监听房间状态变化
    watchRoom(roomId: string, callback: (room: RoomData | null) => void) {
        try {
            console.log('开始监听房间:', roomId);
            
            // 检查数据库是否已初始化
            if (!this.initialized || !this.roomDb) {
                console.warn('房间数据库未初始化，无法监听房间');
                callback(null);
                return null;
            }
            
            // 先获取当前房间状态
            this.getRoom(roomId).then(currentRoom => {
                if (currentRoom) {
                    console.log('获取到当前房间状态，触发回调:', currentRoom);
                    callback(currentRoom);
                }
            });
            
            // 设置实时监听
            const watcher = this.roomDb.where({
                roomId: roomId
            }).watch({
                onChange: (snapshot: any) => {
                    console.log('房间监听回调:', {
                        roomId: roomId,
                        docsCount: snapshot.docs.length,
                        snapshotType: snapshot.type,
                        changes: snapshot.type
                    });
                    
                    if (snapshot.docs.length > 0) {
                        const roomData = snapshot.docs[0].data;
                        console.log('房间数据更新:', roomData);
                        callback(roomData as RoomData);
                    } else {
                        console.log('房间数据为空，可能房间已被删除');
                        callback(null);
                    }
                },
                onError: (error: any) => {
                    console.error('监听房间失败:', error);
                    // 发生错误时也传递null，让前端处理
                    callback(null);
                }
            });
            
            // 5秒后检查监听是否正常工作
            setTimeout(() => {
                console.log('检查房间监听状态...');
                this.getRoom(roomId).then(latestRoom => {
                    if (latestRoom) {
                        console.log('5秒后检查，当前房间状态:', latestRoom);
                        callback(latestRoom);
                    }
                });
            }, 5000);
            
            return watcher;
        } catch (error) {
            console.error('设置房间监听失败:', error);
            callback(null);
            return null;
        }
    }

    // 更新游戏状态
    async updateGameState(roomId: string, gameState: number[][], currentPlayer: number) {
        try {
            // 检查数据库是否已初始化
            if (!this.initialized || !this.roomDb) {
                console.warn('房间数据库未初始化，无法更新游戏状态');
                return;
            }

            await this.roomDb.where({
                roomId: roomId
            }).update({
                data: {
                    gameState: gameState,
                    currentPlayer: currentPlayer
                }
            });
        } catch (error) {
            console.error('更新游戏状态失败:', error);
        }
    }

    // 结束游戏
    async finishGame(roomId: string, winner: number) {
        try {
            console.log('结束游戏:', { roomId, winner });
            
            // 检查数据库是否已初始化
            if (!this.initialized || !this.roomDb) {
                console.warn('房间数据库未初始化，无法结束游戏');
                return;
            }
            
            // 首先获取当前房间的完整状态
            const room = await this.getRoom(roomId);
            if (!room) {
                console.error('房间不存在，无法结束游戏');
                return;
            }

            // 再次检查roomDb是否可用（双重保险）
            if (!this.roomDb) {
                console.warn('roomDb为null，无法结束游戏');
                return;
            }
            
            // 更新游戏状态，保持当前的棋盘状态和玩家状态
            await this.roomDb.where({
                roomId: roomId
            }).update({
                data: {
                    gameStatus: 'finished',
                    winner: winner,
                    // 确保棋盘状态和当前玩家状态保持最新
                    gameState: room.gameState,
                    currentPlayer: room.currentPlayer
                }
            });
            
            console.log('游戏状态已更新为finished，获胜者:', winner);
        } catch (error) {
            console.error('结束游戏失败:', error);
        }
    }

    // 重置游戏状态（重新开始）
    async resetGameState(roomId: string, gameState: number[][], currentPlayer: number) {
        try {
            console.log('重置游戏状态:', { roomId, currentPlayer });
            
            // 检查数据库是否已初始化
            if (!this.initialized || !this.roomDb) {
                console.warn('房间数据库未初始化，无法重置游戏状态');
                return;
            }
            
            // 先获取当前房间数据
            const currentRoom = await this.getRoom(roomId);
            if (!currentRoom) {
                console.warn('房间不存在，无法重置游戏状态');
                return;
            }

            // 再次检查数据库是否可用（双重保险）
            if (!this.roomDb) {
                console.warn('roomDb为null，无法重置游戏状态');
                return;
            }

            // 简化更新数据，只更新必要字段
            let updateData: any = {
                gameState: gameState,
                currentPlayer: currentPlayer,
                gameStatus: 'playing'
            };

            // 如果有winner字段，设置为null而不是移除字段
            if (currentRoom.winner !== undefined) {
                updateData.winner = null;
            }

            await this.roomDb.where({
                roomId: roomId
            }).update({
                data: updateData
            });
            
            console.log('游戏状态已重置为playing');
        } catch (error) {
            console.error('重置游戏状态失败:', error);
        }
    }

    // 生成房间ID
    private generateRoomId(): string {
        // 生成六位数的数字房间ID
        const roomId = Math.floor(100000 + Math.random() * 900000).toString();
        console.log('生成新的六位数房间ID:', roomId);
        return roomId;
    }

    // 获取随机房间（匹配功能）
    async getRandomRoom(): Promise<RoomData | null> {
        try {
            // 检查数据库是否已初始化
            if (!this.initialized || !this.roomDb) {
                console.warn('房间数据库未初始化，无法获取随机房间');
                return null;
            }

            const result = await this.roomDb.where({
                gameStatus: 'waiting'
            }).limit(1).get();

            if (result.data.length > 0) {
                return result.data[0] as RoomData;
            }
            return null;
        } catch (error) {
            console.error('获取随机房间失败:', error);
            return null;
        }
    }

    // 离开房间
    async leaveRoom(roomId: string, playerId: string) {
        try {
            // 检查数据库是否已初始化
            if (!this.initialized || !this.roomDb) {
                console.warn('房间数据库未初始化，无法执行离开房间操作');
                return;
            }

            const room = await this.getRoom(roomId);
            if (!room || !room._id) return;

            // 再次检查roomDb是否可用（双重保险）
            if (!this.roomDb) {
                console.warn('roomDb为null，无法执行房间操作');
                return;
            }

            if (room.hostId === playerId) {
                // 房主离开，删除房间
                await this.roomDb.doc(room._id).remove();
                console.log('房主离开，房间已删除:', roomId);
            } else if (room.guestId === playerId) {
                // 客机离开，重置房间状态为等待玩家加入，并清空棋盘
                console.log('客机玩家离开房间，重置房间状态为waiting并清空棋盘:', roomId);
                
                // 创建空的棋盘状态
                const emptyBoard = Array(15).fill(null).map(() => Array(15).fill(0));
                
                await this.roomDb.doc(room._id).update({
                    data: {
                        guestId: '',
                        gameStatus: 'waiting',
                        winner: null, // 清除获胜者信息
                        gameState: emptyBoard, // 清空棋盘数据
                        currentPlayer: 1 // 重置当前玩家为房主（黑子）
                    }
                });
                console.log('房间状态已更新为waiting，棋盘已清空，等待新玩家加入');
            }
        } catch (error) {
            console.error('离开房间失败:', error);
        }
    }
}