# Lỗi Giao diện và chat service + gateway + query MongoDB

## 1. Truy cập giao diện và xem hoạt động qua các nút click và nhập trên html, css

- Bạn hãy truy cập website sau, tự mở trình duyệt ra mà xem , url `https://social-hub-microservices.vercel.app`

- Sau đó nó sẽ tự chuyển đến `https://social-hub-microservices.vercel.app/login` để bạn đăng nhập. Bạn hãy nhập `congdao@gmail.com` tại `div class="relative" > input required placeholder="name@example.com"` , và nhập mật khẩu `12345678` tại `div class="relative" > input reuired placeholder="••••••••"`.

- Sau khi vào được trang chủ. Bạn hãy chuyển đến url `https://social-hub-microservices.vercel.app/messages` , đây là nơi xem tin nhắn, Tại giao diện bạn sẽ thấy 1 thanh bar dọc `Hội thoại` là `div class="w-80 border-r border-slate-200 flex flex-col bg-slate-50 shrink-0"`. Hãy thử ấn vào 1 chat với người tên là `Voldermort` ở `div class="flex items-center space-x-3 p-3 rounded-xl cursor-pointer transition group bg-violet-50 border border-violet-200"`.

- Khi ấn xong sẽ hiển thị ra ô chat với người đó ở `div class="flex-1 flex flex-col min-w-0 bg-white"` ở cạnh bên phải ô `Hội thoại`. Khi tôi ấn vào ô nhập tin nhắn `form class="p-3 border-t border-slate-200 bg-white space-y-3 shrink-0"` để gửi ảnh, tin nhắn và ấn nút để gửi `button type="submit"` thì nó sẽ gửi tin nhắn đi => Cái này áp dụng cho cả chat 2 người và Nhóm chat.

## 2. Yêu cầu

- Bạn hãy mở url ra và làm test như tôi hướng dẫn ở `1. Truy cập giao diện và xem hoạt động qua các nút click và nhập trên html, css`. Sau đó bạn có quyền đọc code API, code logic , code event và mọi thứ ở gateway, chat-service, media-service, notification-service; bạn còn có quyền đọc log ở các docker container đang chạy.

- Hãy hiểu thật sau sẵ code logic, sự kiện, query, data, header, websocket, ... 

## 3. Vấn dề cần giải quyết

## 3.3. Vấn đề 1: 

- Khi có ai đó nhắn tin đến tôi. ở từng phần tử chat ví dụ chat với người tên là `Voldermort` ở `div class="flex items-center space-x-3 p-3 rounded-xl cursor-pointer transition group bg-violet-50 border border-violet-200"` thì có đoạn  chat, hiện tại đã chỉ load phân trang 10 tin nhắn => OKE ổn. Nhưng khi kéo dần lên để xem chat cũ tin nhắn cũ hơn thì nó vẫn load được nhưng khi laod ra thêm tin nhắn cũ thfi nó giao diện lại tự kéo xuống tin nhắn gần đây nhất chứu không giữ cố định lại vị trí. 