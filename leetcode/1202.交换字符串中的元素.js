/*******************************************
 ***Problema: Smallest String With Swaps
 ***ID: 1202
 ***Juez: LeetCode
 ***Tipo: DFS|BFS + Sorting
 *******************************************/

/**
 * @param {string} s
 * @param {number[][]} pairs
 * @return {string}
 */
// 整体思路，取出能连续交换的位置数字，进行字母序重排后重组字符串
// 关键概念：并查集 https://zh.wikipedia.org/wiki/%E5%B9%B6%E6%9F%A5%E9%9B%86
var smallestStringWithSwaps = function(s, pairs) {
    // 初始化集合
    const makeSet = [];
    for (let i = 0; i < s.length; i++) {
        makeSet.push(i);
    }
    // 并查集 - find
    // 此处用数组形式表示, 值代表集合父节点
    const find = (i) => {
        // 如果相同，说明自己就是父节点，返回自己
        if (makeSet[i] === i) {
            return i;
        } else {
            // 查找父节点
            // 路径压缩, 每次查找后，将元素直接指向父节点，打平整棵树
            let parent = find(makeSet[i]);
            makeSet[i] = parent;
            return parent;
        }
    }
    // 并查集 - union
    for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i];
        const l = pair[0];
        const r = pair[1];
        const lp = find(l);
        const rp = find(r);
        // l和r 合并，将l的父节点指向r的父节点
        makeSet[lp] = rp;
    }
    // 路径压缩
    for (let i = 0; i < s.length; i++) {
        find(i);
    }
    // console.log(makeSet);
    let strMap = {}, res = '';
    // 字符串按集合分配
    for (let i = 0; i < makeSet.length; i++) {
        let ele = makeSet[i];
        strMap[ele] = strMap[ele] || '';
        strMap[ele] += s[i];
    }
    // 按字符序号重排字符串
    for (const key in strMap) {
        strMap[key] = strMap[key].split('').sort();
    }
    // 重排
    for (let i = 0; i < makeSet.length; i++) {
        res += strMap[makeSet[i]].shift();
    }
    return res;
};


// console.log(smallestStringWithSwaps("dcabfge", [[0,3],[1,2],[0,2],[4,6]]));
// console.log(smallestStringWithSwaps(
//     "cba",
//     [[0,1],[1,2]]
// ));
console.log(smallestStringWithSwaps(
"udyyek",
[[3,3],[3,0],[5,1],[3,1],[3,4],[3,5]]
));
