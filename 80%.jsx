// ==============================================================================
// SCRIPT AFTER EFFECTS HOÀN CHỈNH - CÔNG CỤ XỬ LÝ TEXT LAYER
// Phiên bản 2.6: Bổ sung tính năng Dịch sang phải (Shift Right).
// Phiên bản 2.5: Cải tiến chế độ ngắt từ Trái/Phải - Tự động xóa khoảng trắng thừa.
// Phiên bản 2.4: Bổ sung tính năng ngắt dòng theo ký tự phân cách.
// Yêu cầu: After Effects phiên bản 24.3 trở lên để sử dụng tính năng ngắt dòng.
// ==============================================================================


// --- HÀM LOGIC 1: processRawData (Xử lý dữ liệu thô) ---
function processRawData(rawText, selectedLineIndex) {
    if (!rawText || typeof rawText !== 'string' || rawText.replace(/^\s+|\s+$/g, '').length === 0) { return ""; }
    var allLinesRaw = rawText.split('\n');
    var cleanLines = [];
    for (var i = 0; i < allLinesRaw.length; i++) {
        var trimmedLine = allLinesRaw[i].replace(/^\s+|\s+$/g, '');
        if (trimmedLine !== "") { cleanLines.push(trimmedLine); }
    }
    var extractedLines = [];
    for (var i = 0; i < cleanLines.length; i += 5) {
        var targetIndexInCleanArray = i + selectedLineIndex;
        if (targetIndexInCleanArray < cleanLines.length) { extractedLines.push(cleanLines[targetIndexInCleanArray]); }
    }
    return extractedLines.join(' // ');
}

// --- HÀM LOGIC 2: applyPerLineStyling (Áp dụng định dạng cho từng dòng) ---
function applyPerLineStyling(currentLayer, newTextWithBreak, sizeLine1, sizeLine2) {
    if (!currentLayer || !(currentLayer instanceof TextLayer)) { return false; }
    try {
        var sourceTextProp = currentLayer.property("Source Text");
        var textDocument = sourceTextProp.value;
        textDocument.text = newTextWithBreak;
        var fullText = textDocument.text;
        var lineBreakIndex = fullText.indexOf('\r');
        if (lineBreakIndex === -1) {
            textDocument.fontSize = sizeLine1;
        } else {
            var totalLength = fullText.length;
            var line1Range = textDocument.characterRange(0, lineBreakIndex);
            line1Range.fontSize = sizeLine1;
            var line2Start = lineBreakIndex + 1;
            var line2Range = textDocument.characterRange(line2Start, totalLength);
            line2Range.fontSize = sizeLine2;
        }
        sourceTextProp.setValue(textDocument);
        return true;
    } catch (e) { return false; }
}

// --- HÀM LOGIC 3 (CHÍNH): modifyProjectLayers (Thực thi thay đổi trên project) ---
function modifyProjectLayers(config) {
    // Hàm phụ trợ ngắt dòng (ĐÃ NÂNG CẤP V2.5)
    function addLineBreak(text, lineBreakConfig) {
        if (!lineBreakConfig.enabled) { return text; }
        
        var breakPosition;
        
        // Chế độ: Ngắt theo Ký tự
        if (lineBreakConfig.mode === "delimiter") {
            var delimiter = lineBreakConfig.delimiter;
            if (delimiter === "") { return text; }
            var delimiterIndex = text.indexOf(delimiter);

            if (delimiterIndex === -1) { return text; }

            var firstPart = text.substring(0, delimiterIndex).replace(/^\s+|\s+$/g, '');
            var secondPart = text.substring(delimiterIndex + delimiter.length).replace(/^\s+|\s+$/g, '');
            
            return firstPart + "\r" + secondPart;
        } 
        
        // Chế độ: Ngắt tại khoảng trắng đầu tiên
        else if (lineBreakConfig.mode === "space") {
            var spaceIndex = text.indexOf(' ');
            if (spaceIndex === -1) { return text; }
            var firstPart = text.substring(0, spaceIndex).replace(/^\s+|\s+$/g, '');
            var secondPart = text.substring(spaceIndex + 1).replace(/^\s+|\s+$/g, '');
            return firstPart + "\r" + secondPart;
        }

        // Chế độ: Ngắt từ Trái
        else if (lineBreakConfig.mode === "left") {
            if (text.length <= lineBreakConfig.fromLeft) { return text; }
            breakPosition = lineBreakConfig.fromLeft;
        } 
        
        // Chế độ: Ngắt từ Phải (mặc định)
        else { // mode === "right"
            if (text.length <= lineBreakConfig.fromRight) { return text; }
            breakPosition = text.length - lineBreakConfig.fromRight;
        }

        // --- Logic v2.5: Cắt chuỗi và Tự động Trim khoảng trắng ---
        var firstPart = text.substring(0, breakPosition).replace(/^\s+|\s+$/g, '');
        var secondPart = text.substring(breakPosition).replace(/^\s+|\s+$/g, '');
        
        return firstPart + "\r" + secondPart;
    }

    app.beginUndoGroup("Áp Dụng Thay Đổi Text Layer Hàng Loạt");
    
    var project = app.project;
    if (!project) { alert("Vui lòng mở một project trước."); app.endUndoGroup(); return; }
    
    var patternArray = config.patternString.split("//");
    var modifiedCount = 0;

    for (var i = 1; i <= project.numItems; i++) {
        if (project.item(i) instanceof CompItem) {
            var currentComp = project.item(i);
            for (var j = 1; j <= currentComp.numLayers; j++) {
                var currentLayer = currentComp.layer(j);
                if (!(currentLayer instanceof TextLayer && currentLayer.property("Source Text") !== null && currentLayer.enabled && !currentLayer.locked)) { continue; }
                
                var sourceTextProp = currentLayer.property("Source Text");
                var searchableText = sourceTextProp.value.text.replace(/^\s+|\s+$/g, '');
                
                var found = false;
                var matchedPattern = "";
                for (var p = 0; p < patternArray.length; p++) {
                    var currentPattern = patternArray[p].replace(/^\s+|\s+$/g, '');
                    if (searchableText === currentPattern) {
                        found = true;
                        matchedPattern = currentPattern;
                        break;
                    }
                }

                if (found) {
                    try {
                        if (config.lineBreak.enabled) {
                            var newTextWithBreak = addLineBreak(matchedPattern, config.lineBreak);
                            applyPerLineStyling(currentLayer, newTextWithBreak, config.lineBreak.size1, config.lineBreak.size2);
                        } else {
                            var textDocument = sourceTextProp.value;
                            textDocument.fontSize = textDocument.fontSize + config.increase;
                            sourceTextProp.setValue(textDocument);
                        }
                        
                        var positionProp = currentLayer.property("Transform").property("Position");
                        var currentPositionValue = positionProp.value;
                        
                        // --- Logic v2.6: Tính toán vị trí X và Y ---
                        var newXPosition = currentPositionValue[0] + config.shiftRight; // Dịch phải (Cộng)
                        var newYPosition = currentPositionValue[1] - config.shiftUp;    // Dịch lên (Trừ)
                        
                        var newPositionValue = [newXPosition, newYPosition];
                        
                        // Bảo toàn trục Z nếu là layer 3D
                        if (currentPositionValue.length === 3) {
                            newPositionValue.push(currentPositionValue[2]);
                        }
                        positionProp.setValue(newPositionValue);
                        
                        modifiedCount++;
                    } catch(e) { /* Bỏ qua lỗi */ }
                }
            }
        }
    }
    
    app.endUndoGroup();

    if (modifiedCount > 0) {
        alert("Hoàn tất! Đã sửa đổi thành công " + modifiedCount + " text layer.");
    } else {
        alert("Hoàn tất! Không tìm thấy text layer nào trùng khớp với danh sách đã cung cấp.");
    }
}


// --- GIAO DIỆN NGƯỜI DÙNG (UI) ---
(function() {
    var myWindow = new Window('palette', 'Công Cụ Xử Lý Text Layer v2.6', undefined);
    myWindow.orientation = 'column'; myWindow.alignChildren = 'fill';

    var inputPanel = myWindow.add('panel', undefined, '1. Dữ Liệu Đầu Vào');
    inputPanel.alignment = 'fill'; inputPanel.alignChildren = 'left';
    inputPanel.add('statictext', undefined, 'Dán dữ liệu thô vào đây:');
    var rawDataEditText = inputPanel.add('edittext', undefined, '', { multiline: true, preferredSize: [400, 200] });
    rawDataEditText.alignment = 'fill';
    inputPanel.add('statictext', undefined, 'Chọn dòng cần trích xuất:');
    var radioGroup = inputPanel.add('group', undefined);
    radioGroup.orientation = 'row';
    var lineRadioButtons = [];
    for(var i=1; i<=5; i++){ lineRadioButtons.push(radioGroup.add('radiobutton', undefined, 'Dòng ' + i)); }
    lineRadioButtons[0].value = true;
    
    var optionsPanel = myWindow.add('panel', undefined, '2. Tùy Chỉnh Thay Đổi');
    optionsPanel.alignment = 'fill'; optionsPanel.alignChildren = 'fill';
    var sizeGroup = optionsPanel.add('group', undefined);
    sizeGroup.orientation = 'row';
    sizeGroup.add('statictext', undefined, 'Tăng cỡ chữ (chung):');
    var increaseAmountEditText = sizeGroup.add('edittext', [0, 0, 50, 20], '14');
    
    // --- UI v2.6: Thêm Dịch sang phải ---
    var shiftGroup = optionsPanel.add('group', undefined);
    shiftGroup.orientation = 'row';
    shiftGroup.add('statictext', undefined, 'Dịch lên trên:');
    var shiftUpAmountEditText = shiftGroup.add('edittext', [0, 0, 50, 20], '65');
    
    shiftGroup.add('statictext', undefined, '   Dịch sang phải:'); // Thêm khoảng cách
    var shiftRightAmountEditText = shiftGroup.add('edittext', [0, 0, 50, 20], '0'); // Mặc định là 0

    var noteText = optionsPanel.add('statictext', undefined, 'Lưu ý: 65 là đảo lên trên, 115 nếu là 1 IN X');
    noteText.graphics.foregroundColor = noteText.graphics.newPen(noteText.graphics.PenType.SOLID_COLOR, [0.5, 0.5, 0.5], 1);
    optionsPanel.add('panel', [0,0,400,2], '', {borderStyle: 'etched'});
    
    var lineBreakMainGroup = optionsPanel.add('group', undefined);
    lineBreakMainGroup.orientation = 'column'; lineBreakMainGroup.alignChildren = 'left';
    var enableLineBreakCheckbox = lineBreakMainGroup.add('checkbox', undefined, 'Bật ngắt dòng (Yêu cầu AE 24.3+)');
    var lineBreakOptionsGroup = lineBreakMainGroup.add('group', undefined);
    lineBreakOptionsGroup.orientation = 'column'; lineBreakOptionsGroup.alignChildren = 'left';
    var breakModeGroup = lineBreakOptionsGroup.add('group', undefined);
    breakModeGroup.orientation = 'row';
    breakModeGroup.add('statictext', undefined, 'Chế độ:');
    var breakModeRightRb = breakModeGroup.add('radiobutton', undefined, 'Ngắt từ Phải');
    var breakModeLeftRb = breakModeGroup.add('radiobutton', undefined, 'Ngắt từ Trái');
    var breakModeDelimiterRb = breakModeGroup.add('radiobutton', undefined, 'Ngắt theo Ký tự');
    var breakModeSpaceRb = breakModeGroup.add('radiobutton', undefined, 'Ngắt tại Space');
    breakModeRightRb.value = true;

    // Group cho chế độ Ngắt từ Phải
    var breakFromRightGroup = lineBreakOptionsGroup.add('group', undefined);
    breakFromRightGroup.orientation = 'row';
    breakFromRightGroup.add('statictext', undefined, 'Ký tự từ phải:');
    var breakFromRightEditText = breakFromRightGroup.add('edittext', [0, 0, 50, 20], '3');

    // Group cho chế độ Ngắt từ Trái
    var breakFromLeftGroup = lineBreakOptionsGroup.add('group', undefined);
    breakFromLeftGroup.orientation = 'row';
    breakFromLeftGroup.add('statictext', undefined, 'Ký tự từ trái:');
    var breakFromLeftEditText = breakFromLeftGroup.add('edittext', [0, 0, 50, 20], '6');

    // Group mới cho chế độ Ngắt theo Ký tự
    var breakDelimiterGroup = lineBreakOptionsGroup.add('group', undefined);
    breakDelimiterGroup.orientation = 'row';
    breakDelimiterGroup.add('statictext', undefined, 'Ký tự:');
    var breakDelimiterEditText = breakDelimiterGroup.add('edittext', [0, 0, 50, 20], '/');

    lineBreakOptionsGroup.add('panel', [0,0,380,2], '', {borderStyle: 'etched'});
    var perLineSizeGroup = lineBreakOptionsGroup.add('group', undefined);
    perLineSizeGroup.orientation = 'row';
    perLineSizeGroup.add('statictext', undefined, 'Cỡ chữ Dòng 1:');
    var sizeLine1EditText = perLineSizeGroup.add('edittext', [0, 0, 50, 20], '20');
    perLineSizeGroup.add('statictext', undefined, '   Cỡ chữ Dòng 2:');
    var sizeLine2EditText = perLineSizeGroup.add('edittext', [0, 0, 50, 20], '30');

    lineBreakOptionsGroup.enabled = false;
    
    // Logic tương tác UI ban đầu
    breakFromLeftGroup.enabled = false;
    breakDelimiterGroup.enabled = false;

    var executeButton = myWindow.add('button', undefined, 'Thực Thi');
    executeButton.alignment = 'center';

    enableLineBreakCheckbox.onClick = function() {
        lineBreakOptionsGroup.enabled = this.value; 
    };
    
    breakModeRightRb.onClick = function() {
        breakFromRightGroup.enabled = true;
        breakFromLeftGroup.enabled = false;
        breakDelimiterGroup.enabled = false;
    };
    breakModeLeftRb.onClick = function() {
        breakFromRightGroup.enabled = false;
        breakFromLeftGroup.enabled = true;
        breakDelimiterGroup.enabled = false;
    };
    breakModeDelimiterRb.onClick = function() {
        breakFromRightGroup.enabled = false;
        breakFromLeftGroup.enabled = false;
        breakDelimiterGroup.enabled = true;
    };

    breakModeSpaceRb.onClick = function() {
        breakFromRightGroup.enabled = false;
        breakFromLeftGroup.enabled = false;
        breakDelimiterGroup.enabled = false;
    };
    
    // --- HÀM onClick ---
    executeButton.onClick = function() {
        var rawText = rawDataEditText.text;
        if (rawText.replace(/^\s+|\s+$/g, '') === "") {
            alert("Lỗi: Vui lòng dán dữ liệu thô vào ô nhập liệu."); return;
        }
        var selectedLineIndex = -1;
        for (var i = 0; i < lineRadioButtons.length; i++) {
            if (lineRadioButtons[i].value === true) { selectedLineIndex = i; break; }
        }
        
        var increaseAmount = parseInt(increaseAmountEditText.text);
        
        // --- Controller v2.6: Lấy giá trị Up và Right ---
        var shiftUpAmount = parseInt(shiftUpAmountEditText.text);
        var shiftRightAmount = parseInt(shiftRightAmountEditText.text);
        
        var breakFromLeft = parseInt(breakFromLeftEditText.text);
        var breakFromRight = parseInt(breakFromRightEditText.text);
        var breakDelimiter = breakDelimiterEditText.text;
        var sizeLine1 = parseInt(sizeLine1EditText.text);
        var sizeLine2 = parseInt(sizeLine2EditText.text);
        
        // Validation có kiểm tra shiftRightAmount
        if (isNaN(increaseAmount) || isNaN(shiftUpAmount) || isNaN(shiftRightAmount) || isNaN(breakFromLeft) || isNaN(breakFromRight) || isNaN(sizeLine1) || isNaN(sizeLine2)) {
            alert("Lỗi: Vui lòng chỉ nhập số hợp lệ vào tất cả các ô tùy chỉnh."); return;
        }

        var isLineBreakEnabled = enableLineBreakCheckbox.value;

        var breakMode = "right";
        if (breakModeLeftRb.value) {
            breakMode = "left";
        } else if (breakModeDelimiterRb.value) {
            breakMode = "delimiter";
        } else if (breakModeSpaceRb.value) {
            breakMode = "space";
        }

        if (isLineBreakEnabled && breakMode === "delimiter" && breakDelimiter.replace(/^\s+|\s+$/g, '') === "") {
            alert("Lỗi: Bạn đã chọn 'Ngắt theo Ký tự' nhưng chưa nhập ký tự phân cách.");
            return;
        }

        if (isLineBreakEnabled && parseFloat(app.version) < 24.3) {
            alert("Lỗi Tương Thích:\nTính năng ngắt dòng với cỡ chữ riêng biệt yêu cầu After Effects phiên bản 24.3 trở lên.\n\nPhiên bản hiện tại của bạn là " + app.version + ".\nVui lòng tắt tính năng này hoặc cập nhật After Effects.");
            return;
        }

        var generatedPatternString = processRawData(rawText, selectedLineIndex);
        if (generatedPatternString === "") {
            alert("Lỗi: Không thể xử lý dữ liệu thô. Dữ liệu có thể không đúng định dạng."); return;
        }

        var config = {
            patternString: generatedPatternString,
            increase: increaseAmount,
            
            // --- CONFIG v2.6: Up và Right riêng biệt ---
            shiftUp: shiftUpAmount,
            shiftRight: shiftRightAmount,
            
            lineBreak: {
                enabled: isLineBreakEnabled,
                mode: breakMode,
                fromLeft: breakFromLeft,
                fromRight: breakFromRight,
                delimiter: breakDelimiter,
                size1: sizeLine1,
                size2: sizeLine2
            }
        };

        modifyProjectLayers(config);
        
        //myWindow.close();
    };

    myWindow.center();
    myWindow.show();
})();