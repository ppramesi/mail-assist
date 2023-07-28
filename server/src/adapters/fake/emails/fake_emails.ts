export const TEST_EMAILS_1 = `From: John Person <john_person@test.com>
To: Jack Johnson <testest@test.com>
Subject: Software Engineering Task
Date: Fri, 22 Jul 2023 10:00:00 +0000
Message-ID: <1234@mail.test.com>
MIME-Version: 1.0
Content-Type: text/plain; charset=UTF-8
Content-Transfer-Encoding: 7bit

Dear Jack,

I hope this email finds you well.

I wanted to inform you of a new software engineering task that needs your attention. It involves enhancing our existing API with a few new endpoints. These new endpoints are critical for our new feature launch that is coming up next month.

Here are the details of the endpoints that we need:

1. \`/users\`: GET, POST, and DELETE methods for managing user data.
2. \`/products\`: GET and POST methods for fetching and adding new products.
3. \`/orders\`: GET, POST, and DELETE methods for order management.

We would like these to be completed by the end of next week, if possible.

Please let me know if you have any questions or if anything is unclear.

Thank you for your hard work!

Best,
John Person`;

export const TEST_EMAILS_2 = `From: Jack Johnson <testest@test.com>
To: John Person <john_person@test.com>
Subject: Re: Software Engineering Task
Date: Fri, 22 Jul 2023 12:00:00 +0000
Message-ID: <5678@mail.test.com>
In-Reply-To: <1234@mail.test.com>
References: <1234@mail.test.com>
MIME-Version: 1.0
Content-Type: text/plain; charset=UTF-8
Content-Transfer-Encoding: 7bit

Dear John,

Thanks for the detailed task. I have a few questions before I can start working on these endpoints.

1. For the \`/users\` endpoint, what fields should the POST method accept for creating a new user?
2. For the \`/products\` endpoint, are there any specific requirements for the data format?
3. Regarding the \`/orders\` endpoint, is there any particular flow that should be followed when creating or deleting an order?

I would also appreciate it if you could provide any existing API documentation or sample data that I could use for reference.

Thanks,
Jack

> Dear Jack,
> 
> I hope this email finds you well.
> 
> I wanted to inform you of a new software engineering task that needs your attention. It involves enhancing our existing API with a few new endpoints. These new endpoints are critical for our new feature launch that is coming up next month.
> 
> Here are the details of the endpoints that we need:
> 
> 1. \`/users\`: GET, POST, and DELETE methods for managing user data.
> 2. \`/products\`: GET and POST methods for fetching and adding new products.
> 3. \`/orders\`: GET, POST, and DELETE methods for order management.
> 
> We would like these to be completed by the end of next week, if possible.
> 
> Please let me know if you have any questions or if anything is unclear.
> 
> Thank you for your hard work!
> 
> Best,
> John Person`;

export const TEST_EMAILS_3 = `From: John Person <john_person@test.com>
To: Jack Johnson <testest@test.com>
Subject: Re: Software Engineering Task
Date: Fri, 22 Jul 2023 14:00:00 +0000
Message-ID: <91011@mail.test.com>
In-Reply-To: <5678@mail.test.com>
References: <1234@mail.test.com> <5678@mail.test.com>
MIME-Version: 1.0
Content-Type: text/plain; charset=UTF-8
Content-Transfer-Encoding: 7bit

Dear Jack,

Thanks for the follow-up. I'm happy to provide more details:

1. For the \`/users\` endpoint, the POST method should accept the following fields: \`username\`, \`email\`, and \`password\`.
2. For the \`/products\` endpoint, the data format should include: \`product_name\`, \`description\`, \`price\`, and \`stock\`.
3. Regarding the \`/orders\` endpoint, the flow for creating an order should involve adding products to a user's cart and then confirming the purchase. When deleting an order, it should only be possible if the order has not yet been shipped.

I'm attaching API documentation with this email. You will find all the information related to the current API and the changes we want to make.

Let me know if you need anything else!

Best,
John Person

> Dear John,
>
> Thanks for the detailed task. I have a few questions before I can start working on these endpoints.
> 
> 1. For the \`/users\` endpoint, what fields should the POST method accept for creating a new user?
> 2. For the \`/products\` endpoint, are there any specific requirements for the data format?
> 3. Regarding the \`/orders\` endpoint, is there any particular flow that should be followed when creating or deleting an order?
> 
> I would also appreciate it if you could provide any existing API documentation or sample data that I could use for reference.
> 
> Thanks,
> Jack
>
>> Dear Jack,
>> 
>> I hope this email finds you well.
>> 
>> I wanted to inform you of a new software engineering task that needs your attention. It involves enhancing our existing API with a few new endpoints. These new endpoints are critical for our new feature launch that is coming up next month.
>> 
>> Here are the details of the endpoints that we need:
>> 
>> 1. \`/users\`: GET, POST, and DELETE methods for managing user data.
>> 2. \`/products\`: GET and POST methods for fetching and adding new products.
>> 3. \`/orders\`: GET, POST, and DELETE methods for order management.
>> 
>> We would like these to be completed by the end of next week, if possible.
>> 
>> Please let me know if you have any questions or if anything is unclear.
>> 
>> Thank you for your hard work!
>> 
>> Best,
>> John Person`;

export const TEST_EMAILS_4 = `Delivered-To: Jack Johnson <testest@test.com>
Received: by 2002:a2e:3314:0:b0:2b6:b60c:14c0 with SMTP id aaaaaaaaaaaaaaa;
        Thu, 27 Jul 2023 07:39:32 -0700 (PDT)
X-Received: by 2002:a25:fb0f:0:b0:d06:a4f3:4b04 with SMTP id j15-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.11.111111111111;
        Thu, 27 Jul 2023 07:39:31 -0700 (PDT)
ARC-Seal: i=1; a=rsa-sha256; t=1111111111; cv=none;
        d=test.com; s=arc-11111111;
        b=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
ARC-Message-Signature: i=1; a=rsa-sha256; c=relaxed/relaxed; d=test.com; s=arc-11111111;
        h=to:subject:message-id:date:from:mime-version:dkim-signature;
        bh=aaaaaaaaaaaaaaaaaaaaaaaaa+aaaaaaaaaa+aaaaaa=;
        fh=aaaaaaaaaaaaaaaaaaaaaaaaaaa+aaaaaaaaaaaaaaaa=;
        b=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa==
ARC-Authentication-Results: i=1; mx.test.com;
       dkim=pass header.i=@test.com header.s=11111111 header.b=aaaaaaaa;
       spf=pass (test.com: domain of notifications@github.com designates 127.0.0.1 as permitted sender) smtp.mailfrom=notifications@github.com;
       dmarc=pass (p=NONE sp=QUARANTINE dis=NONE) header.from=test.com
Return-Path: <notifications@github.com>
Received: from mail-sor-f41.test.com (mail-sor-f41.test.com. [127.0.0.1])
        by mx.test.com with SMTPS id e79-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.1.2023.07.27.07.39.31
        for <testest@test.com>
        (Google Transport Security);
        Thu, 27 Jul 2023 07:39:31 -0700 (PDT)
Received-SPF: pass (test.com: domain of notifications@github.com designates 127.0.0.1 as permitted sender) client-ip=127.0.0.1;
Authentication-Results: mx.test.com;
       dkim=pass header.i=@test.com header.s=11111111 header.b=aaaaaaaa;
       spf=pass (test.com: domain of notifications@github.com designates 127.0.0.1 as permitted sender) smtp.mailfrom=notifications@github.com;
       dmarc=pass (p=NONE sp=QUARANTINE dis=NONE) header.from=test.com
DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed;
        d=test.com; s=11111111; t=1111111111; x=1111111111;
        h=to:subject:message-id:date:from:mime-version:from:to:cc:subject
         :date:message-id:reply-to;
        bh=aaaaaaaaaaaaaaaaaaaaaaaaa+aaaaaaaaaa+aaaaaa=;
        b=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa==
X-Google-DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed;
        d=1e100.net; s=11111111; t=1111111111; x=1111111111;
        h=to:subject:message-id:date:from:mime-version:x-gm-message-state
         :from:to:cc:subject:date:message-id:reply-to;
        bh=aaaaaaaaaaaaaaaaaaaaaaaaaa+aaaaaaaaa+aaaaaa=;
        aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa==
X-Gm-Message-State: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
X-Google-Smtp-Source: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa=
X-Received: by 2002:a25:aba3:0:b0:c73:e6b5:c452 with SMTP id v32-aaaaaaaaaaaaaaaaaaaaaaaaaaaaa.2.1111111111096; Thu, 27 Jul 2023 07:39:31 -0700 (PDT)
MIME-Version: 1.0
From: Some Guy <notifications@github.com>
Date: Thu, 27 Jul 2023 21:39:20 +0700
Message-ID: <aaaaaaa=aaaaaaaaaaaaa+aaaaaaaaaaaaaaa-aaaaaaaa-VERA@mail.mail.com>
Subject: test
To: testest@test.com
Content-Type: multipart/alternative; boundary="aaaaaaaaaaaaaaaaaaaaaaaaaaaa"

--aaaaaaaaaaaaaaaaaaaaaaaaaaaa
Content-Type: text/plain; charset="UTF-8"

Hello Mr. Johnson! We are from Github and we'd like to introduce you to our new product: GitStuff!

--aaaaaaaaaaaaaaaaaaaaaaaaaaaa
Content-Type: text/html; charset="UTF-8"

<div dir="ltr">Hello Mr. Johnson! We are from Github and we'd like to introduce you to our new product: GitStuff!</div>

--aaaaaaaaaaaaaaaaaaaaaaaaaaaa--`;
