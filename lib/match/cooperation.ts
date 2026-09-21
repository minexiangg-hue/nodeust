/** Explicit requests for shared participation. This never identifies the activity
 * or proves that two posts are compatible; domain parsers still supply both. */
export function requestsCooperation(value: string, domain: 'study' | 'activity'): boolean {
  const text=value.normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'");
  const clauses=text.split(/[.!?。！？;；\n]+/).map(s=>s.trim()).filter(Boolean);
  return clauses.some(clause=>{
    // Do not turn a quoted/negated invitation into the author's active request.
    if (/\b(?:not|never|no longer|don't|do not|doesn't|does not|without|just quoting|quoted|used to)\b|不想|不需要|唔想|唔需要|不是|並非|并非|只是引用/.test(clause)) return false;
    const study=/\b(?:study|studying|revise|revising|revision|review|reviewing|learn|learning|practice|practise|practicing|practising|work through|solve|solving)\b|[温溫][习習书書]?|[复複][习習]|[练練][习習]|[学學][习習]|做[题題]|刷[题題]/;
    if(domain==='study'&&!study.test(clause))return false;
    const companion=/\b(?:looking for|seeking|need|want|find)\s+(?:(?:a|an|some|another|fellow|one|more|study|practice|revision)\s+){0,4}(?:peers?|partners?|budd(?:y|ies)|companions?|classmates?|someone|somebody|people)\b/;
    const joint=/\b(?:anyone|anybody|someone|somebody)\b.{0,45}\b(?:together|with me|with us)\b|\b(?:let's|shall we)\b.{0,60}\b(?:together|study|revise|practice|practise)\b/;
    const chinese=/(?:想|希望|可以)?(?:找|搵|揾|約|约).{0,10}(?:同[学學]|人|朋友|伙伴|夥伴|搭子).{0,15}(?:一起|一齊|一齐)|(?:有人|有冇人|有沒有人|有没有人).{0,20}(?:一起|一齊|一齐)/;
    return companion.test(clause)||joint.test(clause)||chinese.test(clause);
  });
}
