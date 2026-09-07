// Loopback-only fixture: production dist + real Go API. Not a deployment server.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve('web/dist');
const types = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'};
const server = http.createServer((req,res) => {
  if (req.url.startsWith('/api/') || req.url === '/readyz') {
    const upstream = http.request({hostname:'127.0.0.1',port:8080,path:req.url,method:req.method,headers:req.headers}, response => {
      res.writeHead(response.statusCode,response.headers);response.pipe(res);
    });
    upstream.on('error',()=>{res.writeHead(502);res.end();});req.pipe(upstream);return;
  }
  let file;
  try {file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));}catch{res.writeHead(400);res.end();return;}
  if (!file.startsWith(root+'/') && file!==root) {res.writeHead(403);res.end();return;}
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file=path.join(root,'index.html');
  res.setHeader('Content-Type',types[path.extname(file)] || 'application/octet-stream');
  res.setHeader('Cache-Control','no-store');fs.createReadStream(file).pipe(res);
});
server.on('upgrade',(req,socket,head)=>{
  if(req.url!=='/api/ws'){socket.destroy();return;}
  const upstream=http.request({hostname:'127.0.0.1',port:8080,path:req.url,headers:req.headers});
  upstream.on('upgrade',(response,peer,peerHead)=>{
    socket.write(`HTTP/1.1 101 Switching Protocols\r\n${Object.entries(response.headers).map(([k,v])=>`${k}: ${v}`).join('\r\n')}\r\n\r\n`);
    if(peerHead.length)socket.write(peerHead);if(head.length)peer.write(head);peer.pipe(socket);socket.pipe(peer);
    peer.on('error',()=>socket.destroy());socket.on('error',()=>peer.destroy());
  });
  upstream.on('error',()=>socket.destroy());upstream.end();
});
server.listen(5173,'127.0.0.1');
