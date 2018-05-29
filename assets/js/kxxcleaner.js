var KXXRecord = function(id){
  
  this.id = id;
  
  this.text = null;
  
  this.regBalance = /^G\/@/;
  this.regComment = /^G\/($|#)\d{4}\d{9}((\*)?.+)$/;
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
    
    if(!matches){
      continue;
    }

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
      

    }

    if(matches[1] === "$"){
      this.recordComments.push(line);
      continue;
    }



  }
}

KXXRecord.prototype.serialize = function(lineEnd){
  var output = "";
  
  this.balances.forEach(function(balance){
    output += balance + lineEnd;
  });
  
  this.recordComments.forEach(function(comment){
    output += comment + lineEnd;
  });
  
  if(this.text){
    output += "G/#0001" + this.id + this.text + lineEnd;
  }
  
  var _this = this;
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
  
  this.regRecordId = /^G\/@\d{2}(\d{9})/;
  
  this.lineEnd = lineEnd || "\r\n";
  this.encoding = encoding || "windows-1250";
  
  this.chunkSize = 1024 * 1024 * 50; // 50 MB
  
  this.onRecord = function(){};
  
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

KXXCleaner.prototype.loadChunk = function(cb){
  
  this.lineCB = cb;

  // no more file left, unsuccessful load
  if(this.chunkStart > this.file.size) return this.lineCB(false);

  // read file chunk
  this.fr.readAsArrayBuffer(this.file.slice(this.chunkStart,this.chunkEnd))

  // update position pointers
  this.chunkStart += this.chunkSize;
  this.chunkEnd += this.chunkSize;
}

KXXCleaner.prototype.processChunk = function(){
  
  // is last chunk? (because of UTF)
  var lastChunk = (this.chunkEnd >= this.file.size);

  // join with start of last string from last load
  this.chunkBuffer += this.td.decode(this.fr.result,{ stream: !lastChunk });

  // splitinto lines
  let chunkLines = this.chunkBuffer.split(this.lineEnd);

  // get the start of last line to the buffer
  if(!lastChunk) this.chunkBuffer = chunkLines.pop();

  let _this = this;
  
  // assign the lines
  chunkLines.forEach(function(line) {
    
    let matches = _this.regRecordId.exec(line);
    
    if(matches && (!_this.record || matches[1] !== _this.record.id)){
      
      if(_this.record) _this.cleanRecord(_this.record);
      
      _this.record = new KXXRecord(matches[1],_this);
    }
    
    _this.record.addLine(line);
  });
  
  if(!lastChunk) this.loadChunk();
  
  else {
    
    if(this.record) this.cleanRecord(_this.record);
    
    this.callback(this.output);
  }
}

KXXCleaner.prototype.cleanRecord = function(record){
  
  record.parse();
  
  if(["KDF","KOF"].indexOf(record.module) !== -1 && record.text){
    record.text = record.text.split("\\n")[0];
  }
  else{
    record.text = "DEL";
  }
  
  record.globalComments.forEach(function(comment){
    comment.forEach(function(commentData){
      switch(commentData.key){
        case "EVKT":
          commentData.value = "DEL";
          break;
      }
    });
  });

  this.output += record.serialize(this.lineEnd);
  
}