export const CATS = [
  {
    id: 'toffee', name: '奶糖', english: 'TOFFEE', breed: '橘猫', age: '2 岁',
    personality: '干饭天才', color: 'pink', votes: 1286,
    line: '可以不爱我，但不能不给我加餐。',
    story: '事务所的快乐能量站。听见开罐头的声音，会以一种不符合体型的速度抵达现场。最拿手的，是用肉垫和你击掌。',
    likes: ['三文鱼罐头', '晒肚皮', '和你击掌'], motto: '把每一天，都过成开饭日。',
  },
  {
    id: 'sesame', name: '芝麻', english: 'SESAME', breed: '英国短毛猫', age: '3 岁',
    personality: '高冷总裁', color: 'mint', votes: 1024,
    line: '不是想你了，只是刚好路过。',
    story: '一位表面上不需要任何人的小总裁。你工作时，它会安静坐在旁边；你离开房间时，它又总会假装不经意地跟过来。',
    likes: ['窗边观察', '纸箱', '假装不在乎'], motto: '这票我收下了，别太骄傲。',
  },
  {
    id: 'pudding', name: '布丁', english: 'PUDDING', breed: '布偶猫', age: '1 岁',
    personality: '温柔小天使', color: 'lilac', votes: 982,
    line: '今天也要，被温柔地接住呀。',
    story: '会把脑袋轻轻放进你手心的小天使。天生擅长认真听人说话，不论你的故事多长，它都会带着一双蓝眼睛陪你听到最后。',
    likes: ['被梳毛', '软软的毯子', '安静陪伴'], motto: '你来啦，我等你好久了。',
  },
  {
    id: 'oreo', name: '奥利奥', english: 'OREO', breed: '奶牛猫', age: '2 岁',
    personality: '搞怪担当', color: 'yellow', votes: 876,
    line: '先别讲道理，陪我疯一下。',
    story: '脑袋里装着一整个游乐园。总能在意想不到的地方找到新玩具，也经常在自己的尾巴面前露出震惊的表情。',
    likes: ['追自己的尾巴', '突然起跑', '逗猫棒'], motto: '快乐的事，为什么要等明天？',
  },
  {
    id: 'cloud', name: '云朵', english: 'CLOUD', breed: '白色长毛猫', age: '2 岁',
    personality: '满级松弛感', color: 'blue', votes: 752,
    line: '没关系，睡醒再说。',
    story: '一团会呼噜的柔软云朵。可以在任何舒适的地方迅速入睡，相信世界上没有一场午觉解决不了的小烦恼。',
    likes: ['午后阳光', '睡回笼觉', '温暖膝盖'], motto: '今天的任务：好好休息。',
  },
  {
    id: 'peach', name: '桃桃', english: 'PEACH', breed: '三花猫', age: '1 岁',
    personality: '元气社交家', color: 'peach', votes: 638,
    line: '喜欢你这件事，我超大声！',
    story: '新朋友见面不到三分钟，就会被它划进自己的亲友圈。每天都有说不完的话，最喜欢的环节是你回家时跑过来迎接你。',
    likes: ['迎接你回家', '认识新朋友', '探险'], motto: '把所有开心，都分你一半。',
  },
];

export const CAT_IDS = CATS.map((cat) => cat.id);
