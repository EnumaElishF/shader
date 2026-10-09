import { _decorator, CCFloat, Component, Node, Sprite } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('noiseChange')

export class noiseChange extends Component {

    @property({ type: CCFloat, group: { name: "溶解阈值0~1", id: "1" } })
    dissolveThreshold: number = 0;
    start() {

    }

    update(deltaTime: number) {
        const sprite = this.getComponent(Sprite);
        const mat = sprite.customMaterial;
        mat.setProperty('dissolveThreshold', this.dissolveThreshold);
    }
}


