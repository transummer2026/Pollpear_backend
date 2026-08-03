// return 503

curl -i http://localhost:3000/auth/login -H 'Content-Type: application/json' -d '{"email":"jojo0@pollpear.com","password":"Password123!"}'


curl -i -X PATCH http://localhost:3000/users/10/ban -b 'sid=2151ad64-1ba9-47a0-b008-4d1799b2317b'


// return 403

curl -i http://localhost:3000/auth/login -H 'Content-Type: application/json' -d '{"email":"user5@pollpear.com","password":"Password123!"}'


curl -i -X PATCH http://localhost:3000/users/10/ban -b 'sid=0c1861ea-4355-422d-a7b5-c87511bf02c3'


curl -i -X PATCH http://localhost:3000/users/10/ban -H 'x-user-id: 5'
curl -i -X PATCH http://localhost:3000/users/10/ban -H 'x-user-id: 6'
