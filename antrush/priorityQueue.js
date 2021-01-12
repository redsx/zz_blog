class MaxPQ {
    constructor() {
        this.key = ['*'];
    }
    getMax() {
        return this.key[1];
    }
    insert(ele) {
        this.key.push(ele);
        this.swim(this.key.length - 1);
    }
    delMax() {
        const maxVal = this.key[1];
        this.exch(1, this.key.length - 1);
        this.key.pop();
        this.sink(1);
        return maxVal;
    }
    // 将第k个元素上浮
    swim(k) {
        while (k > 1 && this.less(this.getParent(k), k)) {
            let parent = this.getParent(k);
            this.exch(k, parent);
            k = parent;
        }
    }
    // 将第k个元素下沉
    sink(k) {
        while (k < this.key.length) {
            let left = this.getLeft(k);
            let right = this.getRight(k);
            let max = this.less(left, right) ? right : left;
            if (this.less(max, k)) break;
            this.exch(max, k);
            k = max;
        }
    }
    less(i1, i2) {
        return (this.key[i1] || 0) < (this.key[i2] || 0);
    }
    exch(idx1, idx2) {
        let tmp = this.key[idx1];
        this.key[idx1] = this.key[idx2];
        this.key[idx2] = tmp;
    }
    getParent(n) {
        if (n === 1) return null;

        return Math.floor(n / 2);
    }
    getLeft(n) {
        return 2 * n;
    }
    getRight(n) {
        return 2 * n + 1;
    }
}


let maxPQ = new MaxPQ();

maxPQ.insert(10);
maxPQ.insert(8);
maxPQ.insert(9);
maxPQ.insert(2);
maxPQ.insert(6);
maxPQ.insert(5);
console.log(maxPQ.delMax())
maxPQ.insert(19);
maxPQ.insert(7);
console.log(maxPQ.key);
console.log(maxPQ.delMax())
console.log(maxPQ.delMax())
console.log(maxPQ.key);
console.log(maxPQ.delMax())
console.log(maxPQ.delMax())
