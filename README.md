# VSCode Quicky

VSCode Quicky, Visual Studio Code editör başlığından CodeLens referanslarını ve seçtiğiniz diğer ayarları tek tıkla açıp kapatmanıza imkan tanıyan hafif ve hızlı bir eklentidir. JavaScript ve TypeScript projelerinde referans CodeLens satırlarını yönetirken aynı anda kendi özel ayarlarınızı da menüye ekleyebilirsiniz.

## Öne çıkan özellikler

- Tek tıkla `typescript.referencesCodeLens.enabled` ve `javascript.referencesCodeLens.enabled` değerlerini değiştirin.
- Herhangi bir VS Code ayarını, özel seçenekleriyle birlikte dinamik menüye ekleyin.
- Aktif dosya veya çalışma alanına göre doğru scope'ta (workspace, folder, user) ayar kaydı oluşturun.
- Seçimlerinizin kaydını takip etmek için dahili çıktı panelini kullanın.

## Kurulum
### VS Code Marketplace
Eklentiyi yayınlandıktan sonra Marketplace üzerinden "VSCode Quicky" yazarak bulabilir ve **Install** butonuna tıklayabilirsiniz.

### Manuel kurulum
```bash
npm install
npm run compile
```

Ardından proje klasörünü VS Code ile açın ve **Run and Debug** panelinden "Launch Extension" hedefini çalıştırın.

## Hızlı başlangıç
1. Herhangi bir dosyayı açın ve editör sekmesinin sağ üst köşesindeki Quicky ikonuna tıklayın.
2. Açılan "Quicky Ayarları" menüsünden **Ayarları Yönet** komutunu seçin.
3. İlk listeden değiştirmek istediğiniz ayarı, ikinci listeden de uygulanacak değeri belirleyin.
4. Seçiminiz anında yürürlüğe girer; uygun scope altında saklanır ve komut paletinden tekrar erişilebilir.

## Dinamik ayar tanımları
Eklentinin `quicky.settingDefinitions` ayarı üzerinden dilediğiniz kadar tanım ekleyebilirsiniz. Eklenti ilk çalıştığında ayar boşsa workspace ayar dosyasına örnek bir kayıt yazar.

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

- `id`: Güncellemek istediğiniz ayarın tam anahtarı.
- `label`: Menüde gösterilecek başlık (boş bırakılırsa `id` değeri kullanılır).
- `options`: Kullanıcıya sunulacak seçenekler; `value` alanı `string`, `number`, `boolean` ya da `null` olabilir.
- `defaultOptionValue`: Ayar tanımlanmamışsa kullanılacak varsayılan değer (isteğe bağlı).

Birden fazla tanım ekleyebilirsiniz; aynı `id` değerine sahip son kayıt önceki tanımı geçersiz kılar.

## İpuçları

- Menüde görmeyi istemediğiniz ayarları `quicky.settingDefinitions` listesinden kaldırabilirsiniz.
- Komutu klavyeden çalıştırmak için `Quicky: Ayarları Yönet` ifadesini komut paletinde aratabilirsiniz.
- Çalışma alanınızda paylaşmak istemediğiniz ayar kombinasyonları için kullanıcı scope'unu tercih edebilirsiniz.

## Katkıda bulunma
Hata raporları, öneriler ve pull request'ler için [GitHub Issues](https://github.com/yildirim/vscode-quicky/issues) sayfasını kullanabilirsiniz. Yeni bir tanım örneği paylaşmak veya dokümantasyona katkıda bulunmak isterseniz lütfen bir issue açın.

## Lisans
Bu proje [GNU Affero General Public License v3.0](https://github.com/sourcebound/vscode-quicky/blob/HEAD/LICENSE) ile lisanslanmıştır.
Kodu kendi projelerinizde kullanırken lisans koşullarını göz önünde bulundurmayı unutmayın.
