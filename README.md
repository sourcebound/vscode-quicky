# VSCode Quicky

VSCode Quicky, Visual Studio Code içinde sık kullanılan ayarları editör başlığından hızlıca değiştirebilmeniz için hazırlanmış hafif bir eklentidir. Varsayılan olarak JavaScript ve TypeScript "references" CodeLens seçeneklerini sunar, ancak dilediğiniz kadar ek ayarı JSON tanımlarıyla menüye ekleyebilirsiniz.

## Kurulum

```bash
npm install
npm run compile
```

Ardından proje klasörünü VS Code ile açıp **Run and Debug** panelinden "Launch Extension" hedefini çalıştırarak eklentiyi deneyebilirsiniz.

## Kullanım

1. Herhangi bir dosyayı açın.
2. Editör sekmesinin sağ üst köşesindeki Quicky ikonuna tıklayın.
3. Açılan "Quicky Ayarları" menüsünden **Ayarları Yönet** komutunu seçin.
4. İlk listeden düzenlemek istediğiniz ayarı, ikinci listeden de uygulanmasını istediğiniz seçeneği belirleyin.

Seçiminiz anında geçerli olur ve uygun scope (klasör, workspace veya kullanıcı ayarları) altında saklanır.

## Dinamik ayar tanımları

Eklentinin `quicky.settingDefinitions` ayarı üzerinden bir veya daha fazla tanım ekleyebilirsiniz. Eklenti ilk çalıştığında, ayar boşsa workspace ayar dosyasına örnek bir kayıt yazar.

Örnek içerik (`.vscode/settings.json`):

```json
[
  {
    "id": "workbench.experimental.share.enabled",
    "label": "Paylaş butonu görünürlüğü",
    "options": [
      { "value": true, "label": "Görünür" },
      { "value": false, "label": "Gizli" }
    ],
    "defaultOptionValue": true
  }
]
```

- `id`: Değiştirmek istediğiniz ayarın tam anahtarı.
- `label`: Menüde gösterilecek başlık.
- `options`: Kullanıcıya sunulacak seçenekler. `value` alanı `string`, `number`, `boolean` ya da `null` olabilir.
- `defaultOptionValue`: Ayar tanımlanmamışsa kullanılacak varsayılan değer (isteğe bağlı).

Birden fazla tanım ekleyebilirsiniz; aynı `id` değerine sahip son kayıt önceki tanımı geçersiz kılar.
