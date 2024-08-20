import * as vscode from 'vscode';
import axios from 'axios';
import path from 'path';

let chatPanel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('Your extension "privy" is now active!');

    // Register the command to open the chat
    const openChatCommand = vscode.commands.registerCommand('privy.openChat', () => {
        if (chatPanel) {
            chatPanel.reveal(vscode.ViewColumn.Beside);
        } else {
            chatPanel = vscode.window.createWebviewPanel(
                'privyChat',
                'Privy Chat',
                vscode.ViewColumn.Beside,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                }
            );

            chatPanel.webview.html = getChatHTML();

            chatPanel.onDidDispose(
                () => {
                    chatPanel = undefined;
                },
                null,
                context.subscriptions
            );

			chatPanel.webview.onDidReceiveMessage(message => {
                switch (message.command) {
                    case 'sendMessage':
                        handleUserMessage(message.text);
                        break;
                    case 'uploadFile':
                        handleFileUpload(message.fileName, message.content);
                        break;
                }
            }, undefined, context.subscriptions);
        }
    });

    context.subscriptions.push(openChatCommand);
}

async function handleFileUpload(fileName: string, content: string) {
    try {
        console.log(`File uploaded: ${fileName}`);
        console.log(`File content: ${content}`);
        const response = await axios.post('http://localhost:5001/ask', {
            fileName: fileName,
            content: content
        });
        if (response.data) {
            console.log(`Server response: ${response.data.reply}`);
            vscode.window.showInformationMessage(`File ${fileName} uploaded successfully.`);
        } else {
            vscode.window.showErrorMessage(`Failed to upload file ${fileName}.`);
        }
    } catch (error) {
        console.error('Error handling file upload:', error);
        vscode.window.showErrorMessage(`Error uploading file ${fileName}: ${error}`);
    }
}

// async function handleUserMessage(message: string) {
//     try {
//         const response = await askLlamaForSuggestions(message);
//         if (chatPanel) {
//             chatPanel.webview.postMessage({ command: 'receiveMessage', text: response });
//         }
//     } catch (error) {
//         console.error('Error processing message:', error);
//         if (chatPanel) {
//             chatPanel.webview.postMessage({ command: 'receiveMessage', text: 'Sorry, an error occurred.' });
//         }
//     }
// }

async function handleUserMessage(message: string) {
    try {
        // Call getCodebaseContext to gather codebase information
        const codebaseContext = await getCodebaseContext();
        
        // Combine the codebase context with the user's message
        const fullMessage = `Given the following codebase context:\n\n${codebaseContext}\n\nUser question: ${message}`;
        
        // Send the combined message to the AI model
        const response = await askLlamaForSuggestions(fullMessage);
        
        // Post the response back to the webview
        if (chatPanel) {
            chatPanel.webview.postMessage({ command: 'receiveMessage', text: response });
        }
    } catch (error) {
        console.error('Error processing message:', error);
        if (chatPanel) {
            chatPanel.webview.postMessage({ command: 'receiveMessage', text: 'Sorry, an error occurred.' });
        }
    }
}

async function askLlamaForSuggestions(message: string): Promise<string> {
    try {
        const response = await axios.post('http://localhost:5001/ask', { code: message });
        return response.data.reply;
    } catch (error) {
        console.error('Error communicating with LLaMA:', error);
        return 'Sorry, I encountered an error while processing your request.';
    }
}

async function getCodebaseContext(): Promise<string> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        return "No workspace folder open.";
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    const files = await vscode.workspace.findFiles('**/*.{js,ts,jsx,tsx}', '**/node_modules/**');
    let context = "";

    for (const file of files.slice(0, 10)) { // Limit to 10 files to avoid overwhelming the LLM
        const relativePath = path.relative(rootPath, file.fsPath);
        const document = await vscode.workspace.openTextDocument(file);
        const content = document.getText();
        context += `File: ${relativePath}\n\n${content}\n\n`;
    }

    return context;
}


function getChatHTML() {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Privy Chat</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    margin: 0;
                    padding: 0;
                    background-color: #f5f5f5;
                    color: #333;
                }
                #chat-container {
                    height: 100vh;
                    display: flex;
                    flex-direction: column;
                    max-width: 800px;
                    margin: 0 auto;
                    background-color: #fff;
                    box-shadow: 0 0 10px rgba(0,0,0,0.1);
                }
                #messages {
                    flex-grow: 1;
                    overflow-y: auto;
                    padding: 20px;
                }
                .message {
                    margin-bottom: 15px;
                    padding: 10px 15px;
                    border-radius: 18px;
                    max-width: 80%;
                    line-height: 1.4;
                }
                .user-message {
                    background-color: #007acc;
                    color: #fff;
                    align-self: flex-end;
                    margin-left: auto;
                }
                .bot-message {
                    background-color: #e9e9e9;
                    color: #333;
                    align-self: flex-start;
                }
                .code-block {
                    background-color: #f4f4f4;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    font-family: 'Courier New', Courier, monospace;
                    padding: 10px;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                    margin-top: 10px;
                }
                #input-container {
                    display: flex;
                    padding: 20px;
                    background-color: #fff;
                    border-top: 1px solid #e0e0e0;
                }
                #message-input {
                    flex-grow: 1;
                    padding: 10px;
                    border: 1px solid #ccc;
                    border-radius: 20px;
                    font-size: 14px;
                }
                #send-button {
                    background-color: #007acc;
                    color: #fff;
                    border: none;
                    padding: 10px 20px;
                    margin-left: 10px;
                    border-radius: 20px;
                    cursor: pointer;
                    font-size: 14px;
                }
                #send-button:hover {
                    background-color: #005fa3;
                }
            </style>
        </head>
        <body>
            <div id="chat-container">
                <div id="messages"></div>
                <div id="input-container">
                    <input type="text" id="message-input" placeholder="Type your message...">
                    <button id="send-button">Send</button>
                </div>
            </div>
            <script>
                const vscode = acquireVsCodeApi();
                const messagesContainer = document.getElementById('messages');
                const messageInput = document.getElementById('message-input');
                const sendButton = document.getElementById('send-button');

                function addMessage(text, isUser = false) {
                    const messageElement = document.createElement('div');
                    messageElement.classList.add('message', isUser ? 'user-message' : 'bot-message');
                    
                    // Check if the message contains code (simple check for now)
                    if (text.includes('\`\`\`')) {
                        const parts = text.split('\`\`\`');
                        for (let i = 0; i < parts.length; i++) {
                            if (i % 2 === 0) {
                                // Regular text
                                messageElement.appendChild(document.createTextNode(parts[i]));
                            } else {
                                // Code block
                                const codeElement = document.createElement('pre');
                                codeElement.classList.add('code-block');
                                codeElement.textContent = parts[i];
                                messageElement.appendChild(codeElement);
                            }
                        }
                    } else {
                        messageElement.textContent = text;
                    }
                    
                    messagesContainer.appendChild(messageElement);
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }

                sendButton.addEventListener('click', () => {
                    const message = messageInput.value.trim();
                    if (message) {
                        addMessage(message, true);
                        vscode.postMessage({ command: 'sendMessage', text: message });
                        messageInput.value = '';
                    }
                });

                messageInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        sendButton.click();
                    }
                });

                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.command) {
                        case 'receiveMessage':
                            addMessage(message.text);
                            break;
                    }
                });
            </script>
        </body>
        </html>
    `;
}

// function getChatHTML() {
//     return `
//         <!DOCTYPE html>
//         <html lang="en">
//         <head>
//             <meta charset="UTF-8">
//             <meta name="viewport" content="width=device-width, initial-scale=1.0">
//             <title>Privy Chat</title>
//             <style>
//             body {
//                     font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
//                     margin: 0;
//                     padding: 0;
//                     background-color: #f5f5f5;
//                     color: #333;
//                 }
//                 #chat-container {
//                     height: 100vh;
//                     display: flex;
//                     flex-direction: column;
//                     max-width: 800px;
//                     margin: 0 auto;
//                     background-color: #fff;
//                     box-shadow: 0 0 10px rgba(0,0,0,0.1);
//                 }
//                 #messages {
//                     flex-grow: 1;
//                     overflow-y: auto;
//                     padding: 20px;
//                 }
//                 .message {
//                     margin-bottom: 15px;
//                     padding: 10px 15px;
//                     border-radius: 18px;
//                     max-width: 80%;
//                     line-height: 1.4;
//                 }
//                 .user-message {
//                     background-color: #007acc;
//                     color: #fff;
//                     align-self: flex-end;
//                     margin-left: auto;
//                 }
//                 .bot-message {
//                     background-color: #e9e9e9;
//                     color: #333;
//                     align-self: flex-start;
//                 }
//                 .code-block {
//                     background-color: #f4f4f4;
//                     border: 1px solid #ddd;
//                     border-radius: 4px;
//                     font-family: 'Courier New', Courier, monospace;
//                     padding: 10px;
//                     white-space: pre-wrap;
//                     word-wrap: break-word;
//                     margin-top: 10px;
//                 }
//                 #input-container {
//                     display: flex;
//                     padding: 20px;
//                     background-color: #fff;
//                     border-top: 1px solid #e0e0e0;
//                 }
//                 #message-input {
//                     flex-grow: 1;
//                     padding: 10px;
//                     border: 1px solid #ccc;
//                     border-radius: 20px;
//                     font-size: 14px;
//                 }
//                 #send-button {
//                     background-color: #007acc;
//                     color: #fff;
//                     border: none;
//                     padding: 10px 20px;
//                     margin-left: 10px;
//                     border-radius: 20px;
//                     cursor: pointer;
//                     font-size: 14px;
//                 }
//                 #send-button:hover {
//                     background-color: #005fa3;
//                 }
//             </style>
//         </head>
//         <body>
//             <div id="chat-container">
//                 <div id="messages"></div>
//                 <div id="input-container">
//                     <input type="text" id="message-input" placeholder="Type your message...">
//                     <button id="send-button">Send</button>
//                 </div>
//             </div>
//             <script>
//                 const vscode = acquireVsCodeApi();
//                 const messagesContainer = document.getElementById('messages');
//                 const messageInput = document.getElementById('message-input');
//                 const sendButton = document.getElementById('send-button');

//                 function addMessage(text, isUser = false) {
//                     const messageElement = document.createElement('div');
//                     messageElement.textContent = (isUser ? 'You: ' : 'Privy: ') + text;
// 					if (text.includes('\`\`\`') {
// 					     const parts = text.split('\`\`\`');
//                         for (let i = 0; i < parts.length; i++) {
//                             if (i % 2 === 0) {
//                                 // Regular text
//                                 messageElement.appendChild(document.createTextNode(parts[i]));
//                             } else {
//                                 // Code block
//                                 const codeElement = document.createElement('pre');
//                                 codeElement.classList.add('code-block');
//                                 codeElement.textContent = parts[i];
//                                 messageElement.appendChild(codeElement);
//                             }
//                         }
					
// 				} else {

// 		      			messageElement.textContent = text;
//                     }
                    
//                     messagesContainer.appendChild(messageElement);
//                     messagesContainer.scrollTop = messagesContainer.scrollHeight;
//                 }

//                 sendButton.addEventListener('click', () => {
//                     const message = messageInput.value.trim();
//                     if (message) {
//                         addMessage(message, true);
//                         vscode.postMessage({ command: 'sendMessage', text: message });
//                         messageInput.value = '';
//                     }
//                 });

//                 messageInput.addEventListener('keypress', (e) => {
//                     if (e.key === 'Enter') {
//                         sendButton.click();
//                     }
//                 });

//                 window.addEventListener('message', event => {
//                     const message = event.data;
//                     switch (message.command) {
//                         case 'receiveMessage':
//                             addMessage(message.text);
//                             break;
//                     }
//                 });
//             </script>
//         </body>
//         </html>
//     `;
// }

export function deactivate() {}