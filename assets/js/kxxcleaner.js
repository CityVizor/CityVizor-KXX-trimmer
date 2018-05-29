var KXXRecord = function(id){

  this.id = id;

  this.text = null;

  this.regBalance = /^G\/@/;
  this.regComment = /^G\/(\$|\#)\d{4}\d{9}((\*)?.+)/;
  this.regCommentData = /\*([A-Z]+)\-([^\*]+)/g;

  this.balances = [];
  this.recordComments = [];
  this.globalComments = [];  

  this.lines = [];

  this.module = null;

}

KXXRecord.prototype.addLine = function(line){
  this.lines.push(line);
}

KXXRecord.prototype.parse = function(){
  var line;

  while((line = this.lines.shift()) !== undefined){

    if(this.regBalance.test(line)) {
      this.balances.push(line);
      continue;
    }

    let matches = this.regComment.exec(line);

    if(matches){

      if(matches[1] === "#"){
        if(matches[3] !== "*"){
          this.text = matches[2];
          continue;
        }

        let commentData = [];
        let matchesData;

        while ((matchesData = this.regCommentData.exec(matches[2])) !== null) {

          commentData.push({key:matchesData[1],value:matchesData[2]});

          if(matchesData[1] === "EVK") this.module = matchesData[2].substr(0,3);
        }

        this.globalComments.push(commentData);
        
        continue;
      }

      if(matches[1] === "$"){        
        this.recordComments.push(matches[2]);
        continue;
      }
      
    }

  }
}

KXXRecord.prototype.serialize = function(lineEnd){
  
  var _this = this;
  
  var output = "";

  this.balances.forEach(function(balance){
    output += balance + lineEnd;
  });

  this.recordComments.forEach(function(comment,i){
    let id = ("0000" + (_this.text ? i + 2 : i + 1)).slice(-4);
    output += "G/$" + id + _this.id + comment + lineEnd;
  });

  if(this.text){
    output += "G/#0001" + this.id + this.text + lineEnd;
  }

  this.globalComments.forEach(function(commentData,i){

    let id = ("0000" + (_this.text ? i + 2 : i + 1)).slice(-4);

    output += "G/#" + id + _this.id;

    commentData.forEach(function(data) {
      output += "*" + data.key + "-" + data.value;
    });

    output += lineEnd;
  });

  return output;
}


var KXXCleaner = function(encoding,lineEnd){

  this.regRecordId = /^G\/([@\$#])\d{2}(\d{9})/;

  this.lineEnd = lineEnd || "\r\n";
  this.encoding = encoding || "windows-1250";

  this.chunkSize = 1024 * 1024;// * 50; // 50 MB  

  this.log = function(){};
  this.error = function(){};

  this.fr = new FileReader();
  this.td = new TextDecoder(this.encoding);
}

KXXCleaner.prototype.clean = function(file,cb){

  this.file = file;
  this.output = "";

  this.callback = cb;

  this.chunkStart = 0;
  this.chunkEnd = this.chunkStart + this.chunkSize;
  this.chunkLines = [];
  this.chunkBuffer = "";


  var _this = this;

  this.fr.onload = function() { _this.processChunk(); }  

  this.loadChunk();
}

KXXCleaner.prototype.loadChunk = function(){

  window.requestAnimationFrame(function(){
  // read file chunk
  this.fr.readAsArrayBuffer(this.file.slice(this.chunkStart,this.chunkEnd))

  // update position pointers
  this.chunkStart += this.chunkSize;
  this.chunkEnd += this.chunkSize;
  }.bind(this));
}

KXXCleaner.prototype.processChunk = function(){

  // is last chunk? (because of UTF)
  var lastChunk = (this.chunkEnd >= this.file.size);

  // join with start of last string from last load
  this.chunkBuffer += this.td.decode(this.fr.result,{ stream: !lastChunk });

  // splitinto lines
  let chunkLines = this.chunkBuffer.split(/\r?\n/);

  // get the start of last line to the buffer
  if(!lastChunk) this.chunkBuffer = chunkLines.pop();

  let _this = this;

  // assign the lines
  chunkLines.forEach(function(line,i) {

    let matches = _this.regRecordId.exec(line);    
    
    if(!matches){
      if(_this.record) _this.processRecord(_this.record);
      _this.record = null;
      _this.processRecord(line);
      return;
    }
    
    if(matches[1] === "@" && (!_this.record || matches[2] !== _this.record.id)){

      if(_this.record) _this.processRecord(_this.record);

      _this.record = new KXXRecord(matches[2],_this);
    }

    _this.record.addLine(line);
  });

  if(!lastChunk) this.loadChunk();

  else {

    if(this.record) this.processRecord(_this.record);

    this.callback(this.output);
  }
}

KXXCleaner.prototype.processRecord = function(record){

  
  if(typeof record === "string"){
    this.output += record.trim() + this.lineEnd;
    return
  }
    
  record.parse();

  var log = {
    id: record.id,
    module: record.module,
    text: null,
    comments: []
  };
  
  record.recordComments = record.recordComments.map(function(comment){
    log.text = ["",comment];
    return "";
  });

  if (["KDF","KOF"].indexOf(record.module) !== -1 && record.text){
    let textParts = record.text.split("\\n");
    record.text = textParts[0];

    log.text = [record.text,textParts[1] ? "\\n" + textParts.slice(1).join("\\n") : ""];
  }
  else if(record.text){
    log.text = ["",record.text];
    record.text = "";
  }

  record.globalComments.forEach(function(comment){
    comment.forEach(function(commentData){
      switch(commentData.key){
        case "EVKT":
          log.comments.push([commentData.key + "-",commentData.value]);
          commentData.value = "DEL";
          break;
      }
    });
  });

  this.log(log);

  this.output += record.serialize(this.lineEnd);

}