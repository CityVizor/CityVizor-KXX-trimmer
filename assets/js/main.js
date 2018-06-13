
// DUE TO iconv-lite WE HAVE TO USE BROWSERIFY :(

var iconv = require("iconv-lite");
var KXXCleaner = require("./kxxcleaner.js");

$(document).ready(function(){

  $("#download").hide();
  
  $("#showInvoices").on("click", function(){

    if($(this).is(":checked")){
      $("#log div").hide();
      $("#log div").filter('.KDF, .KOF').show();
    }
    else{
      $("#log div").show();
    }

  });


  var form = $("form").first();

  form.submit(function(e){
    
    e.preventDefault();
    
    var file = $("#fileInput")[0].files[0];
    
    if(!file) return;

    var encoding = $("#encodingInput").val();
    var lineEnd = "\r\n";

    var kxxCleaner = new KXXCleaner(encoding,lineEnd);

    $("#status").text("Konverze běží, čekejte...");

    var recordCount = 0;
    var invoiceCount = 0;

    $("#invoices").html("");
    $("#recordCount").text(recordCount);
    $("#invoiceCount").text(invoiceCount);

    

    kxxCleaner.error = function(err){ console.error(err); }

    kxxCleaner.log = function(recordLog){

      recordCount++;
      $("#recordCount").text(recordCount);

      if(recordLog.module === "KDF" || recordLog.module === "KOF"){

        var logP = $("<div/>").addClass(recordLog.module);
        logP.append("<strong>Záznam č. " + recordLog.id + " (" + recordLog.module + ")</strong>");

        if(recordLog.text) logP.append("<p>" + recordLog.text[0] + "<del>" + recordLog.text[1] + "</del></p>");

        recordLog.comments.forEach(function(comment) {logP.append("<p>" + comment[0] + "<del>" + comment[1] + "</del></p>");});

        $("#invoices").append(logP);

        invoiceCount++;
        $("#invoiceCount").text(invoiceCount);
      }
    }

    kxxCleaner.clean(file,function(data){

      $("#status").text("Dokončeno.");

      let element = document.createElement('a');
      
      let blob = new Blob([iconv.encode(data,encoding)], {type:'text/plain'});
      let url = window.URL.createObjectURL(blob);

      $("#download").get()[0].download= "upraveno.kxx";
      element.href = url;

      $("#download").attr("href",url);
      
      $("#download").show();

    });
  });

});