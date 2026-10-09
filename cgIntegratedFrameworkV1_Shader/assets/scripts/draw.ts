import { _decorator, Component, Graphics, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('draw')
export class draw extends Component {
    start () {
        const g = this.getComponent(Graphics);
        g.fillRect(0, 0, 200, 150);
    }
}


