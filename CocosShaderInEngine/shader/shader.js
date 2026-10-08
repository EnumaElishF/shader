function main() {
    // 步骤一：获取 gl

    // 创建画布： 手动创建的canvas能让传递给shader.html里调用gl使用，
    // 否则如果直接在shader.html里直接创建会拿到的any类型，这样获得gl的参数必须要转换器一下，要不然拿不到他的参数接口。
    const canvas = document.createElement('canvas');
    document.getElementsByTagName('body')[0].appendChild(canvas);
    canvas.width = 400;
    canvas.height = 300;
    // 获取 WebGL 上下文（Context），后续统称 gl。

    // 因为Cocos是三维渲染，所以这里选择webgl1或者webgl2都可以
    const gl = canvas.getContext("webgl");
    if (!gl) {
        return;
    }

    // 步骤二：顶点着色器

    // 定义顶点着色器文本
    const vertexShaderSource = `
    // 接收顶点位置数据
    attribute vec2 a_position;
    // 着色器入口函数
    void main() {
        // gl_Position 接收的就是一个 vec4，因此需要转换
        gl_Position = vec4(a_position, 0.0, 1.0);
    }`;

    // 根据着色器文本内容，创建 WebGL 上可以使用的着色器对象
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);

    // 步骤三：片元着色器

    // uniform 是全局变量，无需通过顶点着色器作为中介，可在 CPU 端动态修改颜色
    const fragmentShaderSource = `
    precision mediump float;
    uniform vec4 u_color;
    // 着色器入口函数
    void main() {
        gl_FragColor = u_color;
    }`;
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

    // 步骤四：着色程序

    // 将顶点着色器和片元着色器绑定到着色程序上。
    // 这个上一章提过，着色程序需要成对提供，其中一个是顶点着色器，另一个是片元着色器
    const program = createProgram(gl, vertexShader, fragmentShader);

    // 高效绘制多个三角形：->>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
    // 只提供四个顶点
    const positions = [
        0, 0,
        0, 0.5,
        0.7, 0,
        0.7, 0.5,
    ];

    // 同时提供索引数组，从 positions 中取顶点构造顺序
    // 索引从数组的 0 开始
    const indices = [
        0, 1, 2, // 第一个三角形
        2, 1, 3  // 第二个三角形
    ];

    // 上传顶点缓冲
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    // 上传索引缓冲
    const indexBuffer = gl.createBuffer();
    // ELEMENT_ARRAY_BUFFER 是专门用来绑定索引缓冲的
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    // 因为索引不会有小数点，所以取用无符号 16 位整型，合理分配内存
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    // 步骤五：处理绘制的前置工作

    // 设置视口尺寸，将视口和画布尺寸同步
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    // 清除画布颜色，直接设置成透明色。此处是为了便于观察，将它设置成黑色。
    // 注意，渲染管线是每帧都会绘制内容，就好比每帧都在画板上画画，如果不清除的话，就有可能出现花屏现象
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // 步骤六：启动程序，启用顶点属性

    // 启用我们当前需要的着色程序（uniform 必须在 useProgram 之后设置）
    gl.useProgram(program);

    // 给顶点换个颜色：program 链接并启用后，再查询 uniform 位置并赋值
    const vertexColorLocation = gl.getUniformLocation(program, 'u_color');
    // 此处 color 要的可以是 4 个浮点型 color 或者一个浮点型数组，二者选其一即可
    gl.uniform4f(vertexColorLocation, Math.random(), Math.random(), Math.random(), 1.0);

    // 查询顶点要去的地方，并启用属性
    const positionAttributeLocation = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionAttributeLocation);
    // 将顶点缓冲绑定到当前数据缓冲接口上，这样后续操作的缓冲都是当前绑定的缓冲。每次需要使用数据的时候都要绑定一次。
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);

    // 步骤七：告诉属性如何获取数据

    // gl.vertexAttribPointer(positionAttributeLocation, size, type, normalize, stride, offset);
    // positionAttributeLocation：获取顶点着色器上的 “a_position” 属性的位置
    // size：当前一个顶点数据里要取的数据长度，因为绘制的是平面三角形，所以位置只需提供 x，y 即可，所以数量是 2
    // type：数据缓冲类型，此处顶点采用的是 float 32，因此使用 gl.FLOAT
    // normalize：数据是否是归一化的数据，通常不用
    // stride：主要表达数据存储的方式，单位是字节。0 表示属性数据是连续存放的，通常在只有一个属性的数据里这么用
    // offset：属性在缓冲区中每间隔的偏移值，单位是字节
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    // 步骤八：绘制（使用索引缓冲绘制矩形）

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    // gl.drawElements(primitiveType, count, indexType, offset);
    // indexType：指定元素数组缓冲区中的值的类型。有 gl.UNSIGNED_BYTE、gl.UNSIGNED_SHORT 以及扩展类型
    // gl.UNSIGNED_BYTE 最大索引值为 255，gl.UNSIGNED_SHORT 最大索引值为 65535
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

    // 到此处为止就正式启动了绘制的流程了，后续的处理就交给顶点着色器和片段着色器了
}

// 创建着色器 shader。gl：WebGL 上下文；type：着色器类型；source：着色器文本
function createShader(gl, type, source) {
    // 根据 type 创建着色器
    var shader = gl.createShader(type);
    // 绑定内容文本 source
    gl.shaderSource(shader, source);
    // 编译着色器（将文本内容转换成着色器）
    gl.compileShader(shader);
    // 获取编译后的状态
    var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (success) {
        return shader;
    }

    // 获取当前着色器相关信息
    console.log(gl.getShaderInfoLog(shader));
    // 删除失败的着色器
    gl.deleteShader(shader);
}
// 创建着色程序 program。gl：WebGL 上下文；vertexShader：顶点着色器对象；fragmentShader：片元着色器对象
function createProgram(gl, vertexShader, fragmentShader) {
    // 创建着色程序
    var program = gl.createProgram();
    // 让着色程序获取到顶点着色器
    gl.attachShader(program, vertexShader);
    // 让着色程序获取到片元着色器
    gl.attachShader(program, fragmentShader);
    // 将两个着色器与着色程序进行绑定
    gl.linkProgram(program);
    var success = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (success) {
        return program;
    }

    console.log(gl.getProgramInfoLog(program));
    // 绑定失败则删除着色程序
    gl.deleteProgram(program);
}

main();
