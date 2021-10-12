
function main() {
    const canvas = document.querySelector("#glCanvas");
    //Initialize the GL context
    const gl = canvas.getContext("webgl");

    //continue if WebGL is available
    if (gl === null) {
        alert("Webgl possibly unsupported");
        return;
    }

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
}

window.onload = main;
