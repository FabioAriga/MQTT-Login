import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-analytics.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBtS4Kg8fns9ahJe45O1G7xExsXQq4GhhA",
  authDomain: "mqtt-d7154.firebaseapp.com",
  projectId: "mqtt-d7154",
  storageBucket: "mqtt-d7154.firebasestorage.app",
  messagingSenderId: "1025945819081",
  appId: "1:1025945819081:web:c4dabbaf69fd10c8503a18",
  measurementId: "G-BB60HC0R9T"
};

const app = initializeApp(firebaseConfig);
try { getAnalytics(app); } catch (_) { }
const auth = getAuth(app);

function mensagemLogin(text, isSuccess = true, details = "", onClose = null, fecharAuto = 0) {
    const overlay = document.getElementById('message');
    overlay.innerHTML = `
        <div class="modal">
            <div class="title" style="color:${isSuccess ? 'green' : 'crimson'}">${isSuccess ? 'Sucesso' : 'Erro'}</div>
            <div class="details1" style="margin-bottom:8px">${text}</div>
            ${details ? `<div class="details2">${details}</div>` : ''}
            <div style="text-align:right">
                <button class="btnMessage">OK</button>
            </div>
        </div>
    `;
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    function fechar() {
        overlay.classList.remove('active');
        overlay.innerHTML = '';
        overlay.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        if (typeof onClose === 'function') onClose();
    }
    const btnMessage = overlay.querySelector('.btnMessage');
    if (btnMessage) btnMessage.addEventListener('click', fechar, { once: true });
    if (fecharAuto && fecharAuto > 0) {
        setTimeout(fechar, fecharAuto);
    }
}

function login() {
    var email = document.getElementById("email").value;
    var senha = document.getElementById("senha").value;

    signInWithEmailAndPassword(auth, email, senha)
        .then((userCredential) => {
            const user = userCredential.user;
            if (!user.emailVerified) {
                mensagemLogin("Confirme seu e-mail antes de entrar.", false);
                return;
            }
            mensagemLogin("Login efetuado com sucesso.", true, "", () => mostrarTela("telamqtt"), 5000);
            iniciarMQTT();
            document.getElementById("email").value = "";
            document.getElementById("senha").value = "";
        })
        .catch((error) => {
            const errorCode = error.code;
            const errorMessage = error.message;
            mensagemLogin("Não foi possível efetuar o login.", false, `${errorCode} — ${errorMessage}`);
        });
}

function cadastrar() {
    var email = document.getElementById("emailcadastro").value;
    var senha = document.getElementById("senhacadastro").value;

    createUserWithEmailAndPassword(auth, email, senha)
        .then((userCredential) => {
            const user = userCredential.user;
            sendEmailVerification(user)
                .then(() => {
                    mensagemLogin("Cadastro efetuado com sucesso! Um e-mail de confirmação foi enviado.", true, "Verifique sua caixa de entrada, SPAM ou Lixo eletrônico.", () => mostrarTela("telalogin"), 4000);
                })
                .catch(() => {
                    mensagemLogin("Usuário criado, mas não foi possível enviar o e-mail de confirmação.", false);
                });
            document.getElementById("emailcadastro").value = "";
            document.getElementById("senhacadastro").value = "";
        })
        .catch((error) => {
            mensagemLogin(
                "Não foi possível efetuar o cadastro.",
                false,
                `${error.code} — ${error.message}`
            );
        });
}


function redefinirSenha() {
    var email = document.getElementById("email") ? document.getElementById("email").value : "";
    if (!email) {
        mensagemLogin("Informe o e-mail para redefinição.", false);
        return;
    }
    sendPasswordResetEmail(auth, email)
        .then(() => {
            mensagemLogin("E-mail de redefinição enviado. Verifique sua caixa de entrada, SPAM ou Lixo Eletrônico.", true);
        })
        .catch((error) => {
            mensagemLogin("Não foi possível enviar o e-mail de redefinição.", false, `${error.code} — ${error.message}`);
        });
}

function mostrarSenha(fieldId, btnElem) {
    const ionInput = document.getElementById(fieldId);
    if (!ionInput) return;
    ionInput.getInputElement().then(inputEl => {
        if (!inputEl) return;
        if (inputEl.type === 'password') {
            inputEl.type = 'text';
            if (btnElem) btnElem.textContent = 'Ocultar';
        } else {
            inputEl.type = 'password';
            if (btnElem) btnElem.textContent = 'Mostrar';
        }
    }).catch(() => {});
}

function mostrarTela(idTela) {
    document.querySelectorAll(".tela").forEach(tela => {
        tela.classList.remove("ativa");
    })
    document.getElementById(idTela).classList.add("ativa");
}

let client = null;
let conectado = false;

function iniciarMQTT() {
    if (client && client.connected) {
        console.log("Já conectado.");
        return;
    }

    client = mqtt.connect("wss://broker.emqx.io:8084/mqtt");

    client.on("connect", () => {
        mensagemLogin("Conectado ao MQTT", true, "", () => {}, 5000);

        client.subscribe("fabiojun/sala/sensor");
        client.subscribe("fabiojun/sala/led/state");
    });

    client.on("message", (topic, message) => {
        const text = message.toString();

        if (topic === "fabiojun/sala/sensor") {
            try {
                const data = JSON.parse(text);
                document.getElementById("temp").innerHTML =
                    `Temperatura: <b>${data.t.toFixed(1)}°C</b> | Umidade: <b>${data.h.toFixed(1)}%</b>`;
            } catch (e) {}
        }

        if (topic === "fabiojun/sala/led/state") {
            try {
                const data = JSON.parse(text);
                const btn = document.getElementById("btnVentoinha");

                if (data.led === "ON") {
                    btn.textContent = "Desligar ventuinha";
                    btn.dataset.state = "ON";
                } else {
                    btn.textContent = "Ligar ventuinha";
                    btn.dataset.state = "OFF";
                }
            } catch (e) {}
        }
    });

    client.on("error", () => {
        mensagemLogin("Erro ao conectar ao servidor MQTT.", false);
    });
}

function toggleVentoinha() {
    const btn = document.getElementById("btnVentoinha");
    const state = btn.dataset.state || "OFF";

    if (!client || !client.connected) {
        mensagemLogin("Conecte ao MQTT primeiro.", false);
        return;
    }

    if (state === "OFF") {
        client.publish("fabiojun/sala/led/cmd", "ON");
    } else {
        client.publish("fabiojun/sala/led/cmd", "OFF");
    }
}

function sairMQTT() {
    if (client) {
        client.end();
        conectado = false;
        document.getElementById("temp").innerText = "";
        mensagemLogin("Desconectado do MQTT", true, "", () => {}, 2000);
    }
}

window.login = login;
window.cadastrar = cadastrar;
window.redefinirSenha = redefinirSenha;
window.mostrarSenha = mostrarSenha;
window.mostrarTela = mostrarTela;
window.iniciarMQTT = iniciarMQTT;
window.toggleVentoinha = toggleVentoinha;
window.sairMQTT = sairMQTT;