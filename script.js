document.addEventListener('DOMContentLoaded', function() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const previewArea = document.getElementById('previewArea');
    const imagePreview = document.getElementById('imagePreview');
    const removeImage = document.getElementById('removeImage');
    const uploadButtonArea = document.getElementById('uploadButtonArea');
    const uploadButton = document.getElementById('uploadButton');
    const uploadButtonText = document.getElementById('uploadButtonText');
    const uploadSpinner = document.getElementById('uploadSpinner');

    let selectedFile = null;

    // Tesseract.js yükleme - ayarları güncelleyelim
    const worker = Tesseract.createWorker({
        logger: m => {
            console.log(m);
            // Loading durumunu güncelle
            if (m.status === 'recognizing text') {
                uploadButtonText.textContent = `İşleniyor... ${Math.round(m.progress * 100)}%`;
            }
        }
    });

    // Sürükle-bırak olayları
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, preventDefaults);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => {
            uploadArea.classList.add('dragover');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => {
            uploadArea.classList.remove('dragover');
        });
    });

    // Dosya seçme ve önizleme
    uploadArea.addEventListener('drop', handleDrop);
    fileInput.addEventListener('change', handleFileSelect);
    removeImage.addEventListener('click', removeSelectedImage);
    uploadButton.addEventListener('click', handleUpload);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const file = dt.files[0];
        handleFile(file);
    }

    function handleFileSelect(e) {
        const file = e.target.files[0];
        handleFile(file);
    }

    function handleFile(file) {
        if (file && file.type.startsWith('image/')) {
            selectedFile = file;
            const reader = new FileReader();
            
            reader.onload = function(e) {
                imagePreview.src = e.target.result;
                previewArea.style.display = 'block';
                uploadButtonArea.style.display = 'block';
                document.querySelector('.upload-content').style.display = 'none';
            };
            
            reader.readAsDataURL(file);
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Hata!',
                text: 'Lütfen geçerli bir görsel dosyası seçin.'
            });
        }
    }

    function removeSelectedImage() {
        selectedFile = null;
        imagePreview.src = '';
        previewArea.style.display = 'none';
        uploadButtonArea.style.display = 'none';
        document.querySelector('.upload-content').style.display = 'block';
        fileInput.value = '';
        
        // OCR sonuç alanını temizle
        const resultArea = document.getElementById('ocrResultArea');
        if (resultArea) {
            resultArea.remove();
        }
    }

    async function handleUpload() {
        if (!selectedFile) {
            Swal.fire({
                icon: 'error',
                title: 'Hata!',
                text: 'Lütfen bir ruhsat görseli seçin.'
            });
            return;
        }

        uploadButton.disabled = true;
        uploadButtonText.textContent = 'İşleniyor...';
        uploadSpinner.style.display = 'inline-block';

        try {
            // Azure Computer Vision API'ye istek at
            const endpoint = 'https://ocr-service-mobius.cognitiveservices.azure.com/';
            const apiKey = 'AZnDeDETwkpj8DBVqciZWe2IP0tlEr1hLgyYkxGPucouJ908mNm6JQQJ99BAAC5RqLJXJ3w3AAAFACOGM4DN';
            
            const formData = new FormData();
            formData.append('image', selectedFile);

            const response = await fetch(`${endpoint}/vision/v3.2/ocr?language=tr&detectOrientation=true`, {
                method: 'POST',
                headers: {
                    'Ocp-Apim-Subscription-Key': apiKey
                },
                body: formData
            });

            const result = await response.json();
            console.log('API Response:', result);

            // OCR sonucunu işle
            let extractedText = '';
            if (result.regions) {
                result.regions.forEach(region => {
                    region.lines.forEach(line => {
                        line.words.forEach(word => {
                            extractedText += word.text + ' ';
                        });
                        extractedText += '\n';
                    });
                });
            }

            // Plaka ve Şase No'yu bulmak için regex kullanalım
            const plakaMatch = extractedText.match(/([0-9]{2})[A-Z]{1,3}[0-9]{2,4}/);
            // Şase no için özel regex - "(E) ŞASE NO" ifadesinden sonraki 17 karakterli kodu bul
            const saseMatch = extractedText.match(/(?:ŞASE NO\s*)\s*([A-HJ-NPR-Z0-9]{17})/);

            // Plaka kontrolü
            const plaka = plakaMatch ? (() => {
                const plakaNo = parseInt(plakaMatch[1]);
                return (plakaNo >= 1 && plakaNo <= 81) ? plakaMatch[0] : null;
            })() : null;
            
            // Şase no için düzeltilmiş eşleştirme
            const saseNo = saseMatch ? saseMatch[1] : null;

            // Varsa önceki sonuç alanını temizle
            const oldResultArea = document.getElementById('ocrResultArea');
            if (oldResultArea) {
                oldResultArea.remove();
            }

            if (plaka || saseNo) {
                // Yeni sonuç alanı oluştur
                const resultArea = document.createElement('div');
                resultArea.id = 'ocrResultArea';
                resultArea.className = 'mt-4 p-3 bg-light rounded';
                resultArea.innerHTML = `
                    <h4 class="mb-3">Tespit Edilen Bilgiler</h4>
                    <div class="row">
                        ${plaka ? `
                        <div class="col-md-6 mb-3">
                            <strong>Plaka:</strong>
                            <div class="input-group mt-1">
                                <input type="text" class="form-control" id="plakaInput" value="${plaka}">
                                <button class="btn btn-outline-secondary" type="button" title="Düzenle">
                                    <i class="fas fa-edit"></i>
                                </button>
                            </div>
                        </div>
                        ` : ''}
                        ${saseNo ? `
                        <div class="col-md-6 mb-3">
                            <strong>Şase No:</strong>
                            <div class="input-group mt-1">
                                <input type="text" class="form-control" id="saseNoInput" value="${saseNo}">
                                <button class="btn btn-outline-secondary" type="button" title="Düzenle">
                                    <i class="fas fa-edit"></i>
                                </button>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                    <div class="mt-3 text-end">
                        <button class="btn btn-secondary me-2" onclick="removeSelectedImage()">İptal</button>
                        <button class="btn btn-success" id="saveButton">
                            <i class="fas fa-save me-1"></i>
                            Kaydet
                        </button>
                    </div>
                `;

                // Sonuç alanını sayfaya ekle
                const cardBody = document.querySelector('.card-body');
                cardBody.appendChild(resultArea);

                // Kaydet butonuna tıklandığında
                document.getElementById('saveButton').addEventListener('click', async function() {
                    const finalPlaka = document.getElementById('plakaInput')?.value;
                    const finalSaseNo = document.getElementById('saseNoInput')?.value;

                    // Validation
                    if (!finalPlaka || !finalSaseNo) {
                        Swal.fire({
                            icon: 'error',
                            title: 'Hata!',
                            text: 'Plaka ve Şase No alanları boş bırakılamaz.'
                        });
                        return;
                    }

                    try {
                        // Burada backend'e kaydetme işlemi yapılacak
                        // Örnek API çağrısı:
                        /*
                        const response = await fetch('/api/ruhsat/kaydet', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                plaka: finalPlaka,
                                saseNo: finalSaseNo,
                                image: await toBase64(selectedFile)
                            })
                        });
                        */

                        // Başarılı kayıt sonrası
                        Swal.fire({
                            icon: 'success',
                            title: 'Başarılı!',
                            text: 'Ruhsat bilgileri başarıyla kaydedildi.',
                            confirmButtonText: 'Tamam'
                        }).then((result) => {
                            if (result.isConfirmed) {
                                // Formu temizle ve başlangıç durumuna dön
                                removeSelectedImage();
                            }
                        });
                    } catch (error) {
                        console.error('Kaydetme hatası:', error);
                        Swal.fire({
                            icon: 'error',
                            title: 'Hata!',
                            text: 'Kaydetme işlemi sırasında bir hata oluştu.'
                        });
                    }
                });

                // Başarılı OCR bildirimi
                Swal.fire({
                    icon: 'success',
                    title: 'Bilgiler Tespit Edildi',
                    text: 'Lütfen bilgileri kontrol edip doğruysa kaydedin.',
                    confirmButtonText: 'Tamam'
                });
            } else {
                throw new Error('Plaka veya şase numarası bulunamadı');
            }

        } catch (error) {
            console.error('OCR Error:', error);
            Swal.fire({
                icon: 'error',
                title: 'Hata!',
                text: 'Ruhsat bilgileri okunamadı. Lütfen tekrar deneyin.'
            });
        } finally {
            uploadButton.disabled = false;
            uploadButtonText.textContent = 'Ruhsatı Yükle';
            uploadSpinner.style.display = 'none';
        }
    }
}); 